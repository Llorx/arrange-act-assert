import { setTimeout } from "timers/promises";

import test from "../..";

export const path = __filename;
function run() {
    test("test", {
        async ARRANGE() {
            await setTimeout(30);
            return 123
        },
        ACT(data) {
            return data + 2
        },
        ASSERT(data) {
            if (data !== 125) {
                throw new Error("Invalid data");
            }
        }
    });
    console.log("test"); // To capture the output
}
if (process.env.AAA_RUN) {
    run();
}