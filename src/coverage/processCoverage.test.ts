import * as Path from "path";
import type * as Inspector from "inspector";

import test, { monad } from "arrange-act-assert";

import { CoverageEntry, processCoverage } from "./processCoverage";
import * as Utils from "../utils/utils";

// TODO: Add more tests for edge cases
test.describe("processCoverage", test => {
    const testJsFile = "coverage.mock.file.js";
    const testTsFile = "coverage.mock.file.ts";
    function runCoverageFile():Promise<Inspector.Profiler.ScriptCoverage[]> {
        const testFile = Path.resolve(Path.join(__dirname, "..", "..", "precompiled-test-utils", "coverage", "lib", "coverage.mock.run.js"));
        Utils.clearModuleCache(testFile);
        const { run } = require(testFile);
        return run();
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
                exclude: [],
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
                exclude: [],
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