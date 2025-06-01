import * as Assert from "assert";

import test from "../..";
import { assertNumber2 } from "./file2";

test.describe("assertNumber2 (test inside test, obviate)", (test) => {
    test("should work (test inside test, obviate)", {
        ASSERT() {
            assertNumber2(2);
        }
    });
    test("should not work (test inside test, obviate)", {
        ASSERT() {
            Assert.throws(() => assertNumber2(1));
        }
    });
});