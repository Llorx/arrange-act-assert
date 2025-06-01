import * as Assert from "assert";

import { monad, test } from "arrange-act-assert";
import { resolvablePromise, clearModuleCache, processArgs } from "./utils";
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
    test.describe("processArgs", (test) => {
        test("should process args", {
            ACT() {
                return processArgs(["--src", "mySrc", "--multi", "first", "--empty", "--multi", "second", "--multi", "third", "--emptyFinal"]);
            },
            ASSERT(args) {
                Assert.deepStrictEqual(Array.from(args.entries()), [
                    ["src", ["mySrc"]],
                    ["multi", ["first", "second", "third"]],
                    ["empty", [""]],
                    ["emptyFinal", [""]]
                ]);
            }
        });
        test("should process args with =", {
            ACT() {
                return processArgs(["--src", "mySrc", "--multi=first", "--empty", "--multi=second", "--multi", "third", "--emptyFinal"]);
            },
            ASSERT(args) {
                Assert.deepStrictEqual(Array.from(args.entries()), [
                    ["src", ["mySrc"]],
                    ["multi", ["first", "second", "third"]],
                    ["empty", [""]],
                    ["emptyFinal", [""]]
                ]);
            }
        });
        test("should error on invalid args", {
            ACT() {
                return monad(() => processArgs(["--src", "mySrc", "--multi", "first", "errorArg"]));
            },
            ASSERT(res) {
                res.should.error({
                    message: "Invalid argument: errorArg"
                });
            }
        });
    });
});