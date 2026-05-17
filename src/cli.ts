#!/usr/bin/env node
import { TestSuite } from "./TestSuite/TestSuite";
import { DefaultFormatter } from "./formatters/default";
import { getCliOptions, getTestSuiteOptions } from "./utils/utils";

const options = getTestSuiteOptions();
const cliOptions = getCliOptions();
if (cliOptions.summary) {
    options.formatter = new DefaultFormatter(undefined, true);
}

const suite = new TestSuite(options);
suite.run().then(result => {
    if (!result.ok) {
        process.exitCode = 1;
    }
}).catch(e => {
    console.error(e);
    process.exitCode = 2;
});