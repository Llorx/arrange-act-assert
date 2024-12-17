import * as Assert from "assert";

import { test } from "arrange-act-assert";
import { TestSuite } from "./TestSuite/TestSuite";
import { monad, asyncMonad } from "./monad/monad";

import * as INDEX from "./index";

test.describe("index", () => {
    test("Should export all methods and utils", {
        ASSERTS: {
            "should export test function"() {
                Assert.strictEqual(typeof INDEX.test, "function");
            },
            "should export describe function"() {
                Assert.strictEqual(typeof INDEX.describe, "function");
            },
            "should export test function as default"() {
                Assert.strictEqual(INDEX.default, INDEX.test);
            },
            "should export TestSuite"() {
                Assert.strictEqual(INDEX.TestSuite, TestSuite);
            },
            "should export monad util"() {
                Assert.strictEqual(INDEX.monad, monad);
            },
            "should export asyncMonad util"() {
                Assert.strictEqual(INDEX.asyncMonad, asyncMonad);
            }
        }
    });
});