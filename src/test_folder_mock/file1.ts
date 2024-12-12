import * as Assert from "node:assert";

export function assertNumber1(n:number) {
    Assert.strictEqual(n, 1, "is not number 1");
}