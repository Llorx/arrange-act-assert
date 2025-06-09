import { spawn } from "child_process";
import * as Path from "path";

import test from "arrange-act-assert";

import { CoverageEntry } from "./Coverage";
import { monad } from "../monad/monad";

test.describe("Coverage", test => {
    async function runCoverageFile(sourceMaps:boolean) {
        return new Promise<CoverageEntry[]>((resolve, reject) => {
            const args:string[] = [];
            if (sourceMaps) {
                args.push("--enable-source-maps");
            }
            args.push(Path.join(__dirname, "..", "..", "precompiled-test-utils", "coverage", "lib", "coverage.mock.run.js"));
            let resolved = false;
            const child = spawn(process.execPath, args, {
                serialization: "advanced",
                stdio: ["ignore", "ignore", "pipe", "ipc"]
            }).on("error", reject).on("exit", () => {
                if (!resolved) {
                    reject(new Error(`No coverage received. stderr: ${String(Buffer.concat(stderr))}`));
                }
            }).on("message", msg => {
                if (msg && typeof msg ==="object" && "type" in msg && msg.type === "aaa-coverage" && "coverage" in msg) {
                    resolved = true;
                    resolve(msg.coverage as CoverageEntry[]);
                }
            });
            const stderr:Buffer[] = [];
            child.stderr!.on("data", data => {
                stderr.push(data);
            });
        });
    }
    function findMockFile(entries:CoverageEntry[], ext = "") {
        const mockFile = entries.find(({file}) => file.includes(`coverage.mock.file${ext}`));
        if (!mockFile) {
            throw new Error("Mock file not found");
        }
        mockFile.file = Path.basename(mockFile.file);
        return mockFile;
    }
    test("should take no sourcemap coverage", {
        ACT() {
            return runCoverageFile(false);
        },
        ASSERTS: {
            "should find javascript file"(coverage) {
                findMockFile(coverage, ".js");
            },
            "should not find typescript file"(coverage) {
                monad(() => findMockFile(coverage, ".ts")).should.error({
                    message: /Mock file not found/
                });
            }
        },
        SNAPSHOTS: {
            "should return valid ranges"(coverage) {
                return findMockFile(coverage, ".js");
            }
        }
    });
    test("should take sourcemap coverage", {
        ACT() {
            return runCoverageFile(true);
        },
        ASSERTS: {
            "should not find javascript file"(coverage) {
                monad(() => findMockFile(coverage, ".js")).should.error({
                    message: /Mock file not found/
                });
            },
            "should find typescript file"(coverage) {
                findMockFile(coverage, ".ts");
            }
        },
        SNAPSHOTS: {
            "should return valid ranges"(coverage) {
                return findMockFile(coverage, ".ts");
            }
        }
    });
});