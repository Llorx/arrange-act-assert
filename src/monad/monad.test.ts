import * as Assert from "assert";

import { test } from "arrange-act-assert";

import { monad, asyncMonad } from "./monad";

test.describe("monad", (test) => {
    test.describe("sync", (test) => {
        test("should return object when ok", {
            ACT() {
                return monad(() => 123);
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    unwrap: res.unwrap,
                    match: res.match,
                    should: res.should
                });
            }
        });
        test("should return object when error", {
            ACT() {
                return monad(() => {
                    throw "ok";
                });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    unwrap: res.unwrap,
                    match: res.match,
                    should: res.should
                });
            }
        });
        test.describe("should.X", (test) => {
            test("should assert ok", {
                ACT() {
                    return monad(() => 123);
                },
                ASSERT(res) {
                    Assert.doesNotThrow(() => res.should.ok(123));
                }
            });
            test("should assert error", {
                ACT() {
                    return monad(() => {
                        throw new Error("ok")
                    });
                },
                ASSERT(res) {
                    Assert.doesNotThrow(() => res.should.error({
                        message: "ok"
                    }));
                }
            });
        });
        test.describe(".unwrap", (test) => {
            test("should unwrap ok", {
                ARRANGE() {
                    return monad(() => 123);
                },
                ACT(res) {
                    return res.unwrap();
                },
                ASSERT(value) {
                    Assert.strictEqual(value, 123);
                }
            });
            test("should unwrap error", {
                ARRANGE() {
                    return monad(() => {
                        throw new Error("ok");
                    });
                },
                ACT(res) {
                    return monad(() => res.unwrap());
                },
                ASSERT(value) {
                    value.should.error({
                        message: "ok"
                    });
                }
            });
        });
        test.describe(".match", (test) => {
            test("should match ok", {
                ARRANGE() {
                    return monad(() => 123);
                },
                ACT(res) {
                    const ret:{
                        ok?:number|null;
                        error?:unknown;
                    } = {};
                    res.match({
                        ok(value) {
                            ret.ok = value;
                        },
                        error(error) {
                            ret.error = error;
                        }
                    });
                    return ret;
                },
                ASSERT(ret) {
                    Assert.deepStrictEqual(ret, {
                        ok: 123
                    });
                }
            });
            test("should match error", {
                ARRANGE() {
                    return monad(() => {
                        throw "ok";
                    });
                },
                ACT(res) {
                    const ret:{
                        ok?:number|null;
                        error?:unknown;
                    } = {};
                    res.match({
                        ok(value) {
                            ret.ok = value;
                        },
                        error(error) {
                            ret.error = error;
                        }
                    });
                    return ret;
                },
                ASSERT(ret) {
                    Assert.deepStrictEqual(ret, {
                        error: "ok"
                    });
                }
            });
        });
    });
    test.describe("async", (test) => {
        test("should return a promise", {
            ACT() {
                const promise = asyncMonad(async () => 123);
                return { promise };
            },
            ASSERT({ promise }) {
                Assert.strictEqual(promise instanceof Promise, true);
            }
        });
        test("should return object when ok", {
            async ACT() {
                return await asyncMonad(async () => 123);
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    unwrap: res.unwrap,
                    match: res.match,
                    should: res.should
                });
            }
        });
        test("should return object when error", {
            async ACT() {
                return await asyncMonad(async () => {
                    throw "ok";
                });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    unwrap: res.unwrap,
                    match: res.match,
                    should: res.should
                });
            }
        });
        test.describe("should.X", (test) => {
            test("should assert ok", {
                async ACT() {
                    return await asyncMonad(async () => 123);
                },
                ASSERT(res) {
                    Assert.doesNotThrow(() => res.should.ok(123));
                }
            });
            test("should assert error", {
                async ACT() {
                    return await asyncMonad(async () => {
                        throw new Error("ok")
                    });
                },
                ASSERT(res) {
                    Assert.doesNotThrow(() => res.should.error({
                        message: "ok"
                    }));
                }
            });
        });
        test.describe(".unwrap", (test) => {
            test("should unwrap ok", {
                async ARRANGE() {
                    return await asyncMonad(async () => 123);
                },
                ACT(res) {
                    return res.unwrap();
                },
                ASSERT(value) {
                    Assert.strictEqual(value, 123);
                }
            });
            test("should unwrap error", {
                async ARRANGE() {
                    return await asyncMonad(async () => {
                        throw new Error("ok");
                    });
                },
                ACT(res) {
                    return monad(() => res.unwrap());
                },
                ASSERT(value) {
                    value.should.error({
                        message: "ok"
                    });
                }
            });
        });
        test.describe(".match", (test) => {
            test("should match ok", {
                async ARRANGE() {
                    return await asyncMonad(async () => 123);
                },
                ACT(res) {
                    const ret:{
                        ok?:number|null;
                        error?:unknown;
                    } = {};
                    res.match({
                        ok(value) {
                            ret.ok = value;
                        },
                        error(error) {
                            ret.error = error;
                        }
                    });
                    return ret;
                },
                ASSERT(ret) {
                    Assert.deepStrictEqual(ret, {
                        ok: 123
                    });
                }
            });
            test("should match error", {
                async ARRANGE() {
                    return await asyncMonad(async () => {
                        throw "ok";
                    });
                },
                ACT(res) {
                    const ret:{
                        ok?:number|null;
                        error?:unknown;
                    } = {};
                    res.match({
                        ok(value) {
                            ret.ok = value;
                        },
                        error(error) {
                            ret.error = error;
                        }
                    });
                    return ret;
                },
                ASSERT(ret) {
                    Assert.deepStrictEqual(ret, {
                        error: "ok"
                    });
                }
            });
        });
    });
});