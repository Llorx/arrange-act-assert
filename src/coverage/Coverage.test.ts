import * as Path from "path";

import test from "arrange-act-assert";

import { CoverageEntry } from "./Coverage";
import { monad } from "../monad/monad";
import * as Utils from "../utils/utils";

test.describe("Coverage", test => {
    async function runCoverageFile(sourceMaps:boolean) {
        const resetSourceMaps = sourceMaps ? Utils.enableSourceMaps() : Utils.disableSourceMaps();
        const testFile = Path.join(__dirname, "..", "..", "precompiled-test-utils", "coverage", "lib", "coverage.mock.run.js");
        Utils.clearModuleCache(testFile);
        const { run } = require(testFile);
        try {
            return await run(sourceMaps);
        } finally {
            resetSourceMaps.reset();
        }
    }
    function findMockFile(entries:CoverageEntry[], ext = "") {
        const mockFile = entries.find(({file}) => file.includes(`coverage.mock.file${ext}`));
        if (!mockFile) {
            throw new Error("Mock file not found");
        }
        mockFile.file = Path.basename(mockFile.file);
        if (mockFile.originalFile) {
            mockFile.originalFile = Path.basename(mockFile.originalFile);
        }
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