import * as Path from "path";
import * as Assert from "assert";

import test from "arrange-act-assert";

import { MainContext } from "./MainContext";
import { mockFiles } from "../test_folder_mock";

test.describe("MainContext", (test) => {
    test("Should receive all files", {
        ARRANGE() {
            const context = new MainContext();
            const test_folder_mock = Path.dirname(mockFiles["index"]);
            return { context, test_folder_mock };
        },
        async ACT({ context, test_folder_mock }) {
            return await context.getFiles(test_folder_mock, {
                include: [/.*/],
                exclude: []
            });
        },
        ASSERT(files) {
            Assert.deepStrictEqual(files.sort(), Object.values(mockFiles).sort());
        }
    });
});