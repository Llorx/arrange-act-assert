import { test } from "node:test";
import * as Assert from "node:assert";

import { monad, asyncMonad } from "./monad";

test.describe("monad", () => {
    test.describe("sync", () => {
        test("should return object when ok", () => {
            // Act
            const res = monad(() => 123);

            // Assert
            Assert.deepStrictEqual(res, {
                unwrap: res.unwrap,
                match: res.match,
                should: res.should
            });
        });
        test("should return object when error", () => {
            // Act
            const res = monad(() => {
                throw "ok";
            });

            // Assert
            Assert.deepStrictEqual(res, {
                unwrap: res.unwrap,
                match: res.match,
                should: res.should
            });
        });
        test.describe(".should.X", () => {
            test("should assert ok", () => {
                // Act
                const res = monad(() => 123);
    
                // Assert
                Assert.doesNotThrow(() => res.should.ok(123));
            });
            test("should assert error", () => {
                // Act
                const res = monad(() => {
                    throw new Error("ok");
                });
    
                // Assert
                Assert.doesNotThrow(() => res.should.error({
                    message: "ok"
                }));
            });
        });
        test.describe(".unwrap", () => {
            test("should unwrap ok", () => {
                // Arrange
                const res = monad(() => 123);

                // Act
                const value = res.unwrap();

                // Assert
                Assert.strictEqual(value, 123);
            });
            test("should unwrap error", () => {
                // Arrange
                const res = monad(() => {
                    throw new Error("ok");
                });
    
                // Assert
                Assert.throws(() => res.unwrap(), {
                    message: "ok"
                });
            });
        });
        test.describe(".match", () => {
            test("should match ok", () => {
                // Arrange
                const res = monad(() => 123);

                // Act
                res.match({
                    ok(value) {
                        // Assert
                        Assert.strictEqual(value, 123);
                    },
                    error() {
                        // Assert
                        throw new Error("Should not error");
                    }
                });
            });
            test("should match error", () => {
                // Arrange
                const res = monad(() => {
                    throw "ok";
                });
    
                // Act
                res.match({
                    ok() {
                        // Assert
                        throw new Error("Should not ok");
                    },
                    error(error) {
                        // Assert
                        Assert.strictEqual(error, "ok");
                    }
                });
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
        test("should return object when ok", async () => {
            // Act
            const res = await asyncMonad(async () => 123);

            // Assert
            Assert.deepStrictEqual(res, {
                unwrap: res.unwrap,
                match: res.match,
                should: res.should
            });
        });
        test("should return object when error", async () => {
            // Act
            const res = await asyncMonad(async () => {
                throw "ok";
            });

            // Assert
            Assert.deepStrictEqual(res, {
                unwrap: res.unwrap,
                match: res.match,
                should: res.should
            });
        });
        test.describe(".should.X", () => {
            test("should assert ok", async () => {
                // Act
                const res = await asyncMonad(async () => 123);
    
                // Assert
                Assert.doesNotThrow(() => res.should.ok(123));
            });
            test("should assert error", async () => {
                // Act
                const res = await asyncMonad(async () => {
                    throw new Error("ok");
                });
    
                // Assert
                Assert.doesNotThrow(() => res.should.error({
                    message: "ok"
                }));
            });
        });
        test.describe(".unwrap", () => {
            test("should unwrap ok", async () => {
                // Arrange
                const res = await asyncMonad(async () => 123);

                // Act
                const value = res.unwrap();

                // Assert
                Assert.strictEqual(value, 123);
            });
            test("should unwrap error", async () => {
                // Arrange
                const res = await asyncMonad(async () => {
                    throw new Error("ok");
                });
    
                // Assert
                Assert.throws(() => res.unwrap(), {
                    message: "ok"
                });
            });
        });
        test.describe(".match", () => {
            test("should match ok", async () => {
                // Arrange
                const res = await asyncMonad(async () => 123);

                // Act
                res.match({
                    ok(value) {
                        // Assert
                        Assert.strictEqual(value, 123);
                    },
                    error() {
                        // Assert
                        throw new Error("Should not error");
                    }
                });
            });
            test("should match error", async () => {
                // Arrange
                const res = await asyncMonad(async () => {
                    throw "ok";
                });
    
                // Act
                res.match({
                    ok() {
                        // Assert
                        throw new Error("Should not ok");
                    },
                    error(error) {
                        // Assert
                        Assert.strictEqual(error, "ok");
                    }
                });
            });
        });
    });
});