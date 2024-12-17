import * as Assert from "assert";

import test from "arrange-act-assert";

import { filterFiles } from "./filterFiles";

test.describe("filterFiles", (test) => {
    function getMockFiles() {
        return [
            "my/file/test.js",
            "my/file/my-test.js",
            "my/file/my.test.js",
            "my/file/test-my.js",
            "my/file/test.my.js",
            "my/file/tester.js",
            "my/file/tast.js",
            "my/test/ok1.js",
            "my/test/ok2.js"
        ];
    }
    test("should list all test files", {
        ARRANGE() {
            return getMockFiles();
        },
        ACT(mockFiles) {
            return filterFiles(mockFiles, {
                include: [/(\\|\/|.*(\.|-|_))(test)(\.|(\.|-|\\|\/).*.)(cjs|mjs|js)$/i],
                exclude: []
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), [
                "my/file/test.js",
                "my/file/my-test.js",
                "my/file/my.test.js",
                "my/file/test-my.js",
                "my/file/test.my.js",
                "my/test/ok1.js",
                "my/test/ok2.js"
            ].sort());
        }
    });
    test("should exclude test files", {
        ARRANGE() {
            return getMockFiles();
        },
        ACT(mockFiles) {
            return filterFiles(mockFiles, {
                include: [/(\\|\/|.*(\.|-|_))(test)(\.|(\.|-|\\|\/).*.)(cjs|mjs|js)$/i],
                exclude: [/ok1/i]
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), [
                "my/file/test.js",
                "my/file/my-test.js",
                "my/file/my.test.js",
                "my/file/test-my.js",
                "my/file/test.my.js",
                "my/test/ok2.js"
            ].sort());
        }
    });
});
