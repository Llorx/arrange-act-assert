import * as Path from "path";
import { spawn } from "child_process";
import type * as Inspector from "inspector";

import test, { monad } from "arrange-act-assert";

import { CoverageEntry, processCoverage } from "./processCoverage";

function getCoverage(msg:any):Inspector.Profiler.ScriptCoverage[] {
    return (msg && msg.type === "aaa-test-coverage" && msg.coverage) || null;
}

// TODO: Add more tests for edge cases
test.describe("processCoverage", test => {
    const testJsFile = "coverage.mock.file.js";
    const testTsFile = "coverage.mock.file.ts";
    function runCoverageFile() {
        // Isolate tests because of https://github.com/nodejs/node/issues/51251#issuecomment-2597254853
        const testFile = Path.resolve(Path.join(__dirname, "..", "..", "precompiled-test-utils", "coverage", "lib", "coverage.mock.run.js"));
        return new Promise<Inspector.Profiler.ScriptCoverage[]>((resolve, reject) => {
            const child = spawn(process.execPath, [testFile], {
                stdio: ["ignore", "ignore", "ignore", "ipc"]
            });
            let coverage:Inspector.Profiler.ScriptCoverage[]|null = null;
            child.on("message", msg => {
                coverage = getCoverage(msg);
            });
            child.on("error", reject);
            child.on("exit", (code) => {
                if (code !== 0) {
                    reject(new Error(`Child process exit with code ${code}`));
                } else if (coverage == null) {
                    reject(new Error("Coverage not received"));
                } else {
                    resolve(coverage);
                }
            });
        });
    }
    function findCoverageFile(entries:CoverageEntry[], file:string) {
        const mockFile = entries.find(entry => entry.file.includes(file));
        if (!mockFile) {
            throw new Error("Mock file not found");
        }
        mockFile.file = Path.basename(mockFile.file);
        return mockFile;
    }
    test("should process js coverage", {
        ARRANGE() {
            return runCoverageFile();
        },
        ACT(res) {
            return processCoverage(res, {
                branches: true,
                exclude: [/^((?!coverage\.mock\.file).)*$/],
                excludeFiles: [],
                sourceMaps: false
            });
        },
        SNAPSHOTS: {
            "should get correct ranges"(res) {
                return findCoverageFile(res, testJsFile);
            }
        },
        ASSERTS: {
            "should not find typescript file"(res) {
                monad(() => findCoverageFile(res, testTsFile)).should.error({
                    message: /Mock file not found/
                });
            }
        }
    });
    test("should process ts coverage", {
        ARRANGE() {
            return runCoverageFile();
        },
        ACT(res) {
            return processCoverage(res, {
                branches: true,
                exclude: [/^((?!coverage\.mock\.file).)*$/],
                excludeFiles: [],
                sourceMaps: true
            });
        },
        SNAPSHOTS: {
            "should get correct ranges"(res) {
                return findCoverageFile(res, testTsFile);
            }
        },
        ASSERTS: {
            "should not find js file"(res) {
                monad(() => findCoverageFile(res, testJsFile)).should.error({
                    message: /Mock file not found/
                });
            }
        }
    });
});