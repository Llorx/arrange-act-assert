import * as PATH from "path";
import * as Assert from "assert";

import { monad, test, TestFunction } from "arrange-act-assert";

import { TestSuite } from "./TestSuite";
import { mockFiles } from "../test_folder_mock";

test.describe("TestSuite", (test) => {
    test("should validate parallel option", {
        ACT() {
            return monad(() => new TestSuite({
                parallel: -1
            }));
        },
        ASSERT(res) {
            res.should.error({
                message: "Invalid parallel option. Must be >= 0"
            });
        }
    });
    test.describe("run suite", (test) => {
        function run(test:TestFunction, message:string, parallel:number, error = false, invalid = false) {
            test(message, {
                ARRANGE(after) {
                    const suite = new TestSuite({
                        parallel: parallel,
                        include: invalid ? [/mytest/g] : [/mytest-ok/g],
                        folder: PATH.dirname(mockFiles["index"]),
                        ...(parallel === 0 ? { clearModuleCache: true } : {})
                    });
                    if (error) {
                        process.env.ASSERT_NUMBER_1 = "2";
                        after(null, () => {
                            delete process.env.ASSERT_NUMBER_1;
                        });
                    }
                    return suite;
                },
                async ACT(suite) {
                    return await suite.run()
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res.files.sort(), [
                        mockFiles["file1.mytest-ok"],
                        mockFiles["file2.mytest-ok"],
                        ...(invalid ? [mockFiles["file1.mytest-invalid"]] : [])
                    ].sort());
                }
            });
        }
        test.describe("parallel", (test) => {
            run(test, "should run all test files", 1);
            run(test, "should error a test file", 1, true);
            run(test, "should handle invalid files", 1, false, true);
        });
        test.describe("same process", (test) => {
            run(test, "should run all test files", 0);
            run(test, "should error a test file", 0, true);
            run(test, "should handle invalid files", 0, false, true);
        });
    });
});