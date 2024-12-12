import { test } from "node:test";
import * as Assert from "node:assert";

import { resolvablePromise, clearModuleCache, processArgs } from "./utils";
import { mockFiles } from "../test_folder_mock";

test.describe("utils", () => {
    test.describe("newPromise", () => {
        test("newPromise should resolve", async () => {
            const promise = resolvablePromise();
            promise.resolve();
            await promise;
        });
        test("newPromise couldn't resolve 2 times", async () => {
            const promise = resolvablePromise();
            promise.resolve();
            promise.resolve();
            await promise;
        });
        test("newPromise should reject", async () => {
            const promise = resolvablePromise();
            promise.reject(new Error("ok"));
            await Assert.rejects(promise, {
                message: "ok"
            });
        });
        test("newPromise should throw error if rejected after resolve", async () => {
            const promise = resolvablePromise();
            promise.resolve();
            await promise;
            Assert.throws(() => promise.reject(new Error("ok")), {
                message: "Already resolved"
            });
        });
        test("newPromise should not throw error if already rejected", async () => {
            const promise = resolvablePromise();
            promise.reject(new Error("ok"));
            await Assert.rejects(promise, {
                message: "ok"
            });
            promise.reject(new Error("ok2"));
        });
    });
    test.describe("should clear module cache", () => {
        // Act
        test.after(() => clearModuleCache(mockFiles["re-evaluation"]));
        const result1 = require(mockFiles["re-evaluation"]);
        const result2 = require(mockFiles["re-evaluation"]);
        clearModuleCache(mockFiles["re-evaluation"]);
        const result3 = require(mockFiles["re-evaluation"]);
        const result4 = require(mockFiles["re-evaluation"]);

        // Assert
        Assert.strictEqual(result1, result2, "should be equal");
        Assert.strictEqual(result3, result4, "should be equal");
        Assert.notStrictEqual(result2, result3, "should not be equal");
    });
    test.describe("should process args", () => {
        // Act
        const args = processArgs(["--src", "mySrc", "--multi", "first", "--empty", "--multi", "second", "--multi", "third", "--emptyFinal"]);

        // Assert
        Assert.deepStrictEqual(Array.from(args.entries()), [
            ["src", ["mySrc"]],
            ["multi", ["first", "second", "third"]],
            ["empty", [""]],
            ["emptyFinal", [""]]
        ]);
    });
    test.describe("should error on invalid args", () => {
        // Act//Assert
        Assert.throws(() => processArgs(["--src", "mySrc", "--multi", "first", "errorArg"]), {
            message: "Invalid argument: errorArg"
        });
    });
});