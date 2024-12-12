import * as Assert from "node:assert";

export function assertNumber2(n:number) {
    Assert.strictEqual(n, 2, "is not number 2");
}