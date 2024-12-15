import { test } from "node:test";
import * as Assert from "node:assert";

import { TestSuite } from "./TestSuite/TestSuite";
import { monad, asyncMonad } from "./monad/monad";

import * as INDEX from "./index";

test.describe("Index", () => {
    test("Should export all testing methods", async () => {
        // Assert
        Assert.strictEqual(typeof INDEX.test, "function", "doesn't have test method");
        Assert.strictEqual(typeof INDEX.describe, "function", "doesn't have describe method");
        Assert.strictEqual(INDEX.default, INDEX.test, "doesn't export defaults");
        Assert.strictEqual(INDEX.TestSuite, TestSuite, "doesn't export TestSuite");
        Assert.strictEqual(INDEX.monad, monad, "doesn't export monad");
        Assert.strictEqual(INDEX.asyncMonad, asyncMonad, "doesn't export asyncMonad");
    });
});