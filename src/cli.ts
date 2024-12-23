#!/usr/bin/env node
import { TestSuite, TestSuiteOptions } from "./TestSuite/TestSuite";
import { processArgs } from "./utils/utils";

const args = processArgs(process.argv.slice(2));

const options:Partial<TestSuiteOptions> = {};
const folder = args.get("folder");
if (folder) {
    if (folder.length > 1) {
        throw new Error(`Only one --folder argument is allowed`);
    }
    options.folder = folder[0];
}
const parallel = args.get("parallel");
if (parallel != null) {
    if (parallel.length > 1) {
        throw new Error(`Only one --parallel argument is allowed`);
    }
    const parallelNumber = Number(parallel[0]);
    if (!Number.isFinite(parallelNumber)) {
        throw new Error(`Parallel must be a number: ${parallel[0]}`);
    }
    options.parallel = parallelNumber;
}
const includeFiles = args.get("include-files");
if (includeFiles != null) {
    options.include = includeFiles.map(filter => new RegExp(filter));
}
const excludeFiles = args.get("exclude-files");
if (excludeFiles != null) {
    options.exclude = excludeFiles.map(filter => new RegExp(filter));
}
const prefix = args.get("spawn-args-prefix");
if (prefix != null) {
    options.prefix = prefix;
}
const clearModuleCache = args.get("clear-module-cache");
if (clearModuleCache) {
    options.clearModuleCache = true;
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