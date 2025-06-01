import * as Assert from "assert";

import test from "arrange-act-assert";

import { functionRunner } from "./functionRunner";

test.describe("functionRunner", (test) => {
    test("Should run valid function", {
        async ACT() {
            return await functionRunner("test", () => 123, []);
        },
        ASSERT(result) {
            Assert.deepStrictEqual(result, {
                run: true,
                ok: true,
                data: 123
            });
        }
    });
    test("Should get invalid function error", {
        async ACT() {
            return await functionRunner("test", () => { throw "ok" }, []);
        },
        ASSERT(result) {
            Assert.deepStrictEqual(result, {
                run: true,
                ok: false,
                error: "ok",
                type: "test"
            });
        }
    });
    test("Should not run an undefined argument", {
        async ACT() {
            return await functionRunner("test", null, []);
        },
        ASSERT(result) {
            Assert.deepStrictEqual(result, {
                run: false,
                data: undefined
            });
        }
    });
});