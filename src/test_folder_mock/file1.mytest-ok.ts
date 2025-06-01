import * as Assert from "assert";

import test from "..";
import { assertNumber1 } from "./file1";

test.describe("assertNumber1 (test inside test, obviate)", (test) => {
    test("should work (test inside test, obviate)", {
        ASSERT() {
            // env for testing from "outside"
            assertNumber1(process.env.ASSERT_NUMBER_1 != null ? Number(process.env.ASSERT_NUMBER_1) : 1);
        }
    });
    test("should not work (test inside test, obviate)", {
        ASSERT() {
            Assert.throws(() => assertNumber1(2));
        }
    });
});