import * as ASSERT from "node:assert";

export function assertNumber1(n:number) {
    ASSERT.strictEqual(n, 1, "is not number 1");
}