import * as Path from "path";
import * as Assert from "assert";

import test from "arrange-act-assert";

import { mockFiles } from "../test_folder_mock";
import { readDir } from "./readDir";

test.describe("recursiveReadDir", (test) => {
    test("Should receive all files", {
        ARRANGE() {
            const test_folder_mock = Path.dirname(mockFiles["index"]);
            return { test_folder_mock };
        },
        ACT({ test_folder_mock }) {
            return readDir(test_folder_mock, {
                include: [/.*/],
                exclude: []
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), Object.values(mockFiles).sort());
        }
    });
    test("Should include mytest files only", {
        ARRANGE() {
            const test_folder_mock = Path.dirname(mockFiles["index"]);
            return { test_folder_mock };
        },
        ACT({ test_folder_mock }) {
            return readDir(test_folder_mock, {
                include: [/\.mytest/],
                exclude: []
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), [
                mockFiles["file1.mytest-invalid"],
                mockFiles["file1.mytest-ok"],
                mockFiles["file2.mytest-ok"]
            ].sort());
        }
    });
    test("Should exclude subfolder", {
        ARRANGE() {
            const test_folder_mock = Path.dirname(mockFiles["index"]);
            return { test_folder_mock };
        },
        ACT({ test_folder_mock }) {
            return readDir(test_folder_mock, {
                include: [/\.mytest/],
                exclude: [/subfolder/]
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), [
                mockFiles["file1.mytest-invalid"],
                mockFiles["file1.mytest-ok"]
            ].sort());
        }
    });
    test("Should exclude specific file", {
        ARRANGE() {
            const test_folder_mock = Path.dirname(mockFiles["index"]);
            return { test_folder_mock };
        },
        ACT({ test_folder_mock }) {
            return readDir(test_folder_mock, {
                include: [/\.mytest/],
                exclude: [/\.mytest-invalid/]
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), [
                mockFiles["file1.mytest-ok"],
                mockFiles["file2.mytest-ok"]
            ].sort());
        }
    });
});