import * as Assert from "assert";

import { monad, test } from "arrange-act-assert";
import { resolvablePromise, clearModuleCache, getTestSuiteOptions, getTestOptions } from "./utils";
import { mockFiles } from "../test_folder_mock";

test.describe("utils", (test) => {
    test.describe("newPromise", (test) => {
        test("should resolve", {
            ARRANGE() {
                const promise = resolvablePromise();
                return { promise };
            },
            ACT({ promise }) {
                promise.resolve();
            },
            async ASSERT(_, { promise }) {
                await Assert.doesNotReject(promise);
            }
        });
        test("should handle resolve 2 times", {
            ARRANGE() {
                const promise = resolvablePromise();
                return { promise };
            },
            ACT({ promise }) {
                promise.resolve();
                promise.resolve();
            },
            async ASSERT(_, { promise }) {
                await Assert.doesNotReject(promise);
            }
        });
        test("should reject", {
            ARRANGE() {
                const promise = resolvablePromise();
                return { promise };
            },
            ACT({ promise }) {
                promise.reject(new Error("ok"));
            },
            async ASSERT(_, { promise }) {
                await Assert.rejects(promise, {
                    message: "ok"
                });
            }
        });
        test("should throw error if rejected after resolve", {
            async ARRANGE() {
                const promise = resolvablePromise();
                promise.resolve();
                await promise;
                return { promise };
            },
            ACT({ promise }) {
                return monad(() => promise.reject(new Error("ok")));
            },
            ASSERT(res) {
                res.should.error({
                    message: "Already resolved"
                });
            }
        });
        test("should not throw error if already rejected", {
            async ARRANGE() {
                const promise = resolvablePromise();
                promise.reject(new Error("ok"));
                await Assert.rejects(promise, {
                    message: "ok"
                });
                return { promise };
            },
            ACT({ promise }) {
                promise.reject(new Error("ok2"));
            }
        });
    });
    test("clearModuleCache", {
        ARRANGE(after) {
            after(null, () => clearModuleCache(mockFiles["re-evaluation"]));
        },
        ACT() {
            const result1 = require(mockFiles["re-evaluation"]);
            const result2 = require(mockFiles["re-evaluation"]);
            clearModuleCache(mockFiles["re-evaluation"]);
            const result3 = require(mockFiles["re-evaluation"]);
            const result4 = require(mockFiles["re-evaluation"]);
            return { result1, result2, result3, result4 };
        },
        ASSERTS: {
            "before clear should be equal"({ result1, result2 }) {
                Assert.strictEqual(result1, result2);
            },
            "after clear should be equal"({ result3, result4 }) {
                Assert.strictEqual(result3, result4);
            },
            "before and after clear should not be equal"({ result2, result3 }) {
                Assert.notStrictEqual(result2, result3);
            },
        }
    });
    test.describe("getTestSuiteOptions", (test) => {
        test("should process args", {
            SNAPSHOT() {
                return getTestSuiteOptions(["--folder", "test", "--exclude-files", "test", "--parallel", "3", "--include-files", "test", "--include-files", "test2", "--exclude-files", "test2", "--spawn-args-prefix", "ok", "--spawn-args-prefix", "ok2", "--clear-module-cache"]);
            }
        });
        test("should error on empty folder argument", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--folder"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /folder needs a value/
                });
            }
        });
        test("should error on multiple folder value", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--folder", "f1", "f2"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /one --folder argument/
                });
            }
        });
        test("should error on empty parallel argument", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--parallel"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /parallel needs a value/
                });
            }
        });
        test("should error on multiple parallel value", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--parallel", "3", "4"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /one --parallel argument/
                });
            }
        });
        test("should error on invalid parallel value", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--parallel", "a3"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /parallel must be a number/
                });
            }
        });
    });
    test.describe("getTestOptions", (test) => {
        test("should process args", {
            SNAPSHOT() {
                return getTestOptions(["--snapshots-folder", "test", "--snapshots-confirm", "--snapshots-review"]);
            }
        });
        test("should error on empty snapshots-folder argument", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--snapshots-folder"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /snapshots-folder needs a value/
                });
            }
        });
        test("should error on multiple snapshots-folder value", {
            ACT() {
                return monad(() => getTestSuiteOptions(["--snapshots-folder", "f1", "f2"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: /one --snapshots-folder argument/
                });
            }
        });
    });
    test.describe("processArgs", (test) => {
        test("should process args with equal (=)", {
            SNAPSHOT() {
                return getTestSuiteOptions(["--folder=test", "--parallel", "3", "--exclude-files=test", "--include-files", "test", "--include-files=test2", "--exclude-files", "test2", "--spawn-args-prefix", "ok", "--spawn-args-prefix", "ok2", "--clear-module-cache"]);
            }
        });
        test("should process multiple args", {
            SNAPSHOT() {
                return getTestSuiteOptions(["--folder=test", "--parallel", "3", "--exclude-files", "test", "test2", "--include-files", "test", "test2"]);
            }
        });
    });
});