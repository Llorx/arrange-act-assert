import { test } from "node:test";

import { functionRunner } from "./functionRunner";

test.describe("functionRunner", () => {
    test("Should run valid function", async () => {
        const result = await functionRunner("test", ()=>{}, []);
        if (!result.run || !result.ok) {
            throw new Error("Function should run");
        }
    });
    test("Should get invalid function error", async () => {
        const result = await functionRunner("test", ()=>{ throw "ok" }, []);
        if (!result.run || result.ok) {
            throw new Error("Function should run with an error");
        }
        if (!result.run || result.error !== "ok") {
            throw result.error;
        }
    });
    test("Should get value from result", async () => {
        const result = await functionRunner("test", ()=>{ return "ok" }, []);
        if (!result.run || !result.ok) {
            throw new Error("Function should run with an error");
        }
        if (result.data !== "ok") {
            throw new Error("Function should return ok");
        }
    });
    test("Should not run an undefined argument", async () => {
        const result = await functionRunner("test", undefined, []);
        if (result.run) {
            throw new Error("Function should not ");
        }
    });
});