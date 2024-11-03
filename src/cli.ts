#!/usr/bin/env node
import { TestSuite } from "./TestSuite/TestSuite";

const suite = new TestSuite({});
suite.run().then(result => {
    if (!result.ok) {
        process.exitCode = 1;
    }
}).catch(e => {
    console.error(e);
    process.exitCode = 2;
});