import * as Assert from "assert";

import { test } from "arrange-act-assert";
import { TestSuite } from "./TestSuite/TestSuite";
import { monad, asyncMonad } from "./monad/monad";

import * as Index from "./index";

test.describe("index", () => {
    test("Should export all methods and utils", {
        ASSERTS: {
            "should export test function"() {
                Assert.strictEqual(typeof Index.test, "function");
            },
            "should export describe function"() {
                Assert.strictEqual(typeof Index.describe, "function");
            },
            "should export test function as default"() {
                Assert.strictEqual(Index.default, Index.test);
            },
            "should export TestSuite"() {
                Assert.strictEqual(Index.TestSuite, TestSuite);
            },
            "should export monad util"() {
                Assert.strictEqual(Index.monad, monad);
            },
            "should export asyncMonad util"() {
                Assert.strictEqual(Index.asyncMonad, asyncMonad);
            }
        }
    });
});