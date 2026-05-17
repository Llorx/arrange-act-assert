#!/usr/bin/env node
import { TestSuite } from "./TestSuite/TestSuite";
import { getTestSuiteOptions } from "./utils/utils";

const options = getTestSuiteOptions();

const suite = new TestSuite(options);
suite.run().then(result => {
    if (!result.ok) {
        process.exitCode = 1;
    }
}).catch(e => {
    console.error(e);
    process.exitCode = 2;
});