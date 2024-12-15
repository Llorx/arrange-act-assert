import { test } from "node:test";
import * as Assert from "node:assert";

import { monad, asyncMonad } from "./monad";

test.describe("monad", () => {
    test.describe("sync", () => {
        test("should return ok", () => {
            // Act
            const res = monad(() => 123);

            // Assert
            Assert.deepStrictEqual(res, {
                ok: 123,
                should: res.should
            });
        });
        test("should return error", () => {
            // Act
            const res = monad(() => {
                throw "ok";
            });

            // Assert
            Assert.deepStrictEqual(res, {
                error: "ok",
                should: res.should
            });
        });
        test.describe("should", () => {
            test("should assert ok", () => {
                // Act
                const res = monad(() => 123);
    
                // Assert
                Assert.doesNotThrow(() => res.should.ok(123));
            });
            test("should assert error", () => {
                // Act
                const res = monad(() => {
                    throw new Error("ok")
                });
    
                // Assert
                Assert.doesNotThrow(() => res.should.error({
                    message: "ok"
                }));
            });
        });
    });
    test.describe("async", () => {
        test("should return a promise", () => {
            // Act
            const res = asyncMonad(async () => 123);

            // Assert
            Assert.strictEqual(res instanceof Promise, true);
        });
        test("should return ok", async () => {
            // Act
            const res = await asyncMonad(async () => 123);

            // Assert
            Assert.deepStrictEqual(res, {
                ok: 123,
                should: res.should
            });
        });
        test("should return error", async () => {
            // Act
            const res = await asyncMonad(async () => {
                throw "ok";
            });

            // Assert
            Assert.deepStrictEqual(res, {
                error: "ok",
                should: res.should
            });
        });
        test.describe("should", () => {
            test("should assert ok", async () => {
                // Act
                const res = await asyncMonad(async () => 123);
    
                // Assert
                Assert.doesNotThrow(() => res.should.ok(123));
            });
            test("should assert error", async () => {
                // Act
                const res = await asyncMonad(async () => {
                    throw new Error("ok")
                });
    
                // Assert
                Assert.doesNotThrow(() => res.should.error({
                    message: "ok"
                }));
            });
        });
    });
});