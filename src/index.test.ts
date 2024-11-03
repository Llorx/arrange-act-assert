import { test } from "node:test";
import * as ASSERT from "node:assert";

import { TestSuite } from "./TestSuite/TestSuite";

import * as INDEX from "./index";

test.describe("Index", () => {
    test("Should export all testing methods", async () => {
        // Assert
        ASSERT.strictEqual(typeof INDEX.test, "function", "doesn't have test method");
        ASSERT.strictEqual(typeof INDEX.describe, "function", "doesn't have describe method");
        ASSERT.strictEqual(INDEX.default, INDEX.test, "doesn't export defaults");
        ASSERT.strictEqual(INDEX.TestSuite, TestSuite, "doesn't export TestSuite");
    });
});