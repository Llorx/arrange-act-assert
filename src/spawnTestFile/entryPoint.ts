import coverage from "../coverage/singleton";
import type { TestOptions } from "../testRunner/testRunner";
import { getTestOptions } from "../utils/utils";

export const path = __filename;
if (process.env.AAA_TEST_FILE) {
    const testOptions:Partial<TestOptions> = process.env.AAA_TEST_OPTIONS ? JSON.parse(process.env.AAA_TEST_OPTIONS) : getTestOptions();
    if (testOptions.coverage) {
        coverage.start().then(() => {
            require(process.env.AAA_TEST_FILE!);
        }).catch(e => {
            console.error(e);
            require(process.env.AAA_TEST_FILE!);
        });
    } else {
        require(process.env.AAA_TEST_FILE!);
    }
}