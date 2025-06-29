# arrange-act-assert
Zero-dependency lightweight Act-Arrange-Assert oriented testing tool.

# Motivation
[More detailed information here](https://medium.com/@Llorx/how-i-created-my-own-testing-framework-13d998ef5c73).

# Documentation
The tool is pretty straightforward:
```typescript
test("myTest", {
    ARRANGE?(after) {
        // Optional ARRANGE method
        // Receives an "after" callback as the first argument
        const myArrange = 100;
        return { myArrange };
    },
    ACT?({ myArrange }, after) {
        // Optional ACT method
        // Receives the ARRANGE return as the first argument
        // Receives an "after" callback as the second argument
        const myAct = myArrange + 1;
        return { myAct };
    },
    ASSERT?({ myAct }, { myArrange }, after) {
        // Optional ASSERT method
        // Receives the ACT return as the first argument
        // Receives the ARRANGE return as the second argument
        // Receives an "after" callback as the third argument
        myAct === 101;
        myArrange === 100;
    },
    ASSERTS?: {
        // Optional ASSERTS object just in case that you need to
        // check multiple results for the same action, to
        // avoid having a single ASSERT section with multiple assertions
        "should assert one thing"({ myAct }, { myArrange }, after) {
            // Receives the ACT return as the first argument
            // Receives the ARRANGE return as the second argument
            // Receives an "after" callback as the third argument
            myAct === 101;
            myArrange === 100;
        },
        "should assert another thing"({ myAct }, { myArrange }, after) {
            // Receives the ACT return as the first argument
            // Receives the ARRANGE return as the second argument
            // Receives an "after" callback as the third argument
            myAct === 101;
            myArrange === 100;
        }
    }
});
```
All three methods are optional, because maybe you don't need to ARRANGE anything, or maybe you only want to test that the ACT doesn't throw an error without any extra boilerplate.

You also have a `describe` method to group tests:
```typescript
test.describe("myDescribe", (test) => {
    // The describe callback will receive a new `test` object that
    // should be used inside its callback
    test("myTest1", {...});
    test("myTest2", {...});
});
```
And you can call as much describes as you want inside another describes:
```typescript
test.describe("myDescribe", (test) => {
    // Use the new "node:test" function
    test.describe("subdescribe 1", (test) => {
        // Use the new "node:test" function
        test("myTest1", {...});
        test("myTest2", {...});
    });
    test.describe("subdescribe 2", (test) => {
        // Use the new "node:test" function
        test("myTest1", {...});
        test("myTest2", {...});
    });
});
```
And you can add an `after` callback to any test that will run after all queued subtests are executed:
```typescript
test.after(() => {
    console.log("after all tests");
});
test.describe("myDescribe 1", (test) => {
    test.after(() => {
        console.log("after myDescribe 1 tests");
    });
    test("myTest1", {...});
    test("myTest2", {...});
});
test.describe("myDescribe 2", (test) => {
    test.after(() => {
        console.log("after myDescribe 2 tests");
    });
    test("myTest1", {...});
    test("myTest2", {...});
});
```
While this tool forces you to have a single ARRANGE and ACT for each test to avoid sharing different arrangements and trying different actions on the same test, you can actually try to assert different parts of the actions, like so:
```typescript
test("myTest", {
    ARRANGE() {
        const mockSpy = newMockSpy();
        const thing = newThing(mockSpy);
        // Return the mockSpy and the thing
        return { mockSpy, thing };
    },
    async ACT({ thing }) {
        // Do that thing that you want to test and return it
        // This receives as the first argument the ARRANGE return, so
        // just get the "thing" from it and run the method
        return await thing.doThat(); // (yes, methods can be asynchronous)
    },
    ASSERTS: {
        "should return a valid that"(that) {
            // Check that "doThat()" returns the expected result
            // This receives as the first argument the ACT return, so
            // just assert it
            Assert.strictEqual(that, 1);
        },
        "should call the getter one time"(_act, { mockSpy }) {
            // Check in the "mockSpy" that the callbacks were called
            // the necessary times while "doing that()"
            // This receives as the first argument the ACT return, so
            // discard it as we don't need it, but an ASSERT also
            // receives as the second argument the ARRANGE return, so
            // just assert the spy
            Assert.strictEqual(mockSpy.myCallback.getCalls().length, 1);
        }
    }
});
```
Both `test()` and `describe()` return a `Promise<void>` that will resolve when all child tests and describes finish. If any of the child tests or describes fail, the promise will reject with the first error.

Following the NodeJS test runner premise, the `test` function has a recursive `test` method (which points to itself) and a `describe` method so, depending on your liking, you can go all these ways:
```typescript
import test from "arrange-act-assert";

test("myTest", {...});
test.test("myTest", {...});
test.describe("myDescribe", () => {...});
```
or even do this, as you like:
```typescript
import { test, describe } from "arrange-act-assert";

test("myTest", {...});
describe("myDescribe", () => {...});
test.test("myTest", {...});
test.describe("myDescribe", () => {...});
```
To run the tests you just have to call in the cli:
```
npx aaa [OPTIONS]
```
The `aaa` cli command accepts these options:
- `--folder STRING`: The path of the folder where the test files are located. Defaults to the current folder.
- `--parallel NUMBER`: This tool runs test files in subprocesses (one new node process per test file). It will run these amounts of files in parallel. Set to `0` to run all the test files in the very same process, although is not recommended. Defaults to the amount of cores that the running computer has.
- `--include-files REGEX`: The regex to apply to each full file path found to consider it a test file to run. You can set multiple regexes by setting this option multiple times. Defaults to `(\\|\/|.*(\.|-|_))(test)(\.|(\.|-|\\|\/).*.)(cjs|mjs|js)$`.
- `--exclude-files REGEX`: The regex to apply to each full file path found to exclude it. Defaults to `\/node_modules\/i`.
- `--spawn-args-prefix PREFIX`: It will launch the test files with this prefix in the arguments. You can set multiple prefixes by setting this option multiple times.
- `--clear-module-cache`: When you run test files with `parallel` set to `0` (same process), this flag will delete the module cache so when the TestSuite requires a test file, NodeJS will re-require and re-evaluate the file and its dependencies instead of returning the cache, just in case that you need everything clean.
- `--coverage`: Take coverage metrics. More info in the **[Coverage](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#coverage)** section.
- `--coverage-exclude REGEX`: Regex to apply to each full file path found to exclude it. Defaults to `\/node_modules\/i`. More info in the **[Coverage](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#coverage)** section.
- `--coverage-no-branches`: Do not show uncovered branches. More info in the **[Coverage](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#coverage)** section.
- `--coverage-no-source-maps`: When running a full test suite, source maps are enabled by default. Disable them with this option.
- `--snapshots-folder`/`--folder-snapshots`: Folder to place the snapshot files. Defaults to `./snapshots`. More info in the **[Snapshots](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#snapshots)** section.
- `--snapshots-confirm`/`--confirm-snapshots`: Confirm that the new snapshots created in the folder-snapshots are valid. More info in the **[Snapshots](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#snapshots)** section.
- `--snapshots-review`/`--review-snapshots`: Show all the snapshot outputs to check their values. More info in the **[Snapshots](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#snapshots)** section.
- `--snapshots-regenerate`/`--regenerate-snapshots`: Regenerate all snapshot files with new ones. More info in the **[Snapshots](https://github.com/Llorx/arrange-act-assert?tab=readme-ov-file#snapshots)** section.

Alternatively, you can import the `TestSuite` and run your tests programatically:
```typescript
import { TestSuite, TestSuiteOptions, TestResult } from "arrange-act-assert";

const options:TestSuiteOptions = {...};
const suite = new TestSuite(options);
suite.run().then((result:TestResult) => {
    // suite.run() returns a Promise that will resolve with the result of
    // the executed tests
    if (!result.ok) {
        process.exitCode = 1;
    }
}).catch(e => {
    // Or crash if something fails really bad
    console.error(e);
    process.exitCode = 2;
});
```
The types of the option and result objects are like so:
```typescript
// The options
type TestSuiteOptions = {
    parallel:number; // Same logic as the "--parallel" option
    folder:string; // Same logic as the "--folder" option
    include:RegExp[]; // Same logic as the "--include-files" option
    exclude:RegExp[]; // Same logic as the "--exclude-files" option
    prefix:string[]; // Same logic as the "--spawn-args-prefix" option
    clearModuleCache:boolean; // Same logic as the "--clear-module-cache" option
    // This is an interface that will receive the tests events to format them.
    // By default it will output the results in the stdout
    // Example: `https://github.com/Llorx/arrange-act-assert/blob/main/src/formatters/default.ts` search for "DefaultFormatter implements Formatter".
    formatter:Formatter;
    coverage:boolean; // Take coverage metrics
    coverageExclude:RegExp[]; // Same logic as the "--coverage-exclude" option
    coverageNoBranches:boolean; // Same logic as the "--coverage-no-branches" option
    coverageNoSourceMaps:boolean; // Same logic as the "--coverage-no-source-maps" option
    snapshotsFolder:string; // Folder to place the snapshots. Defaults to "./snapshots"
    confirmSnapshots:boolean; // To confirm the new snapshots, as stated in the "Snapshots" section
    reviewSnapshots:boolean; // To review all the snapshots, as stated in the "Snapshots" section
};

// The result
type TestResult = {
    files:string[]; // Test files ran
    runErrors:unknown[]; // Errors received wwhile trying to run the test files (outside of the tests)
    ok:boolean; // If everything went ok (no errors or failed tests anywhere)
    summary:Summary; // The result metrics
};
type Summary = {
    test:SummaryResult; // "test()" functions count
    assert:SummaryResult; // ASSERT() and individual ASSERTS:{...} count
    describe:SummaryResult; // "describe()" functions count
    total:SummaryResult; // Sum of everything up
};
type SummaryResult = { // Self-explanatory
    count:number;
    ok:number;
    error:number;
};
```
To assert errors, you can use the `monad` util:
```typescript
import { test, monad } from "arrange-act-assert";

import { thing, asyncThing } from "./myThing";

test("Should throw an error when invalid arguments", {
    ACT() {
        return monad(() => thing(-1));
    },
    ASSERT(res) {
        res.should.error({
            message: "Argument must be >= 0"
        });
    }
});
test("Should throw an error when invalid arguments in async function", {
    async ACT() {
        return await monad(async () => await thing(-1));
    },
    ASSERT(res) {
        res.should.error({
            message: "Argument must be >= 0"
        });
    }
});
```
It will return a `Monad` object with the methods `should.ok(VALUE)`, `should.error(ERROR)` and `match({ ok:(value)=>void, error:(error)=>void })`. The error validation is done using the [NodeJS Assert.throws() error argument](https://nodejs.org/api/assert.html#assertthrowsfn-error-message).

# Snapshots
There's a snapshots system to easily assert method outputs that should return the same values between tests.

To ensure that snapshots are validated, a confirmation process is implemented: It will first save unvalidated snapshots and show the snapshot output for you to review manually. You must check that the outputs are valid and then the run the tests again with the `--confirm-snapshots` (cli) or `confirmSnapshots: true` (programmatically) option so the new snapshots are validated. Unvalidated snapshots are treated as non-existant for a normal run.

The snapshots are binary files serialized with the [V8.serialize()](https://nodejs.org/api/v8.html#v8serializevalue) method, so all types supported by this serialization method are valid. If you want to review them again, you must use the `--review-snapshots` (cli) or `reviewSnapshots: true` (programmatically) option.

If you want to regenerate a snapshot, you must delete the snapshot file from the filesystem manually and run again the snapshot confirmation process. You can also use the `--regenerate-snapshots` (cli) or `regenerateSnapshots: true` (programmatically) option. It will regenerate all the ran tests with unvalidated snapshots that must be confirmed again.

Snapshots are asserted using the [deepStrictEqual()](https://nodejs.org/api/assert.html#assertdeepstrictequalactual-expected-message) method.

The folder/file structure uses the describe, tests and snapshots descriptions to create the structure, for easy recognition of which test applies to which file.

Example:
```ts
import { test } from "arrange-act-assert";

import { ThingToTest } from "./ThingToTest";

test("Should return a valid thang", {
    ARRANGE() {
        return new ThingToTest();
    },
    SNAPSHOT(thing) { // This will snapshot what getThang() returns to a file and assert it on next runs
        return thing.getThang();
    },
    // Although SNAPSHOT may be considered an assertion itself, you can also ASSERT/ASSERTS the result if needed
    ASSERT(res) {...},
    ASSERTS: {
        "assert 1"(res) {...},
        "assert 2"(res) {...}
    }
});
test("Should return multiple thangs", {
    ARRANGE() {
        return new ThingToTest();
    },
    ACT(thing) {
        return thing.getThangs();
    },
    // If, instead of the full ACT, you need to snapshot different parts of an ACT individually
    // you can create multiple snapshots with this format:
    SNAPSHOTS: {
        "should be oneThang"(res) {
            return res.oneThang;
        },
        "should be twoThang"(res) {
            return res.twoThang;
        }
    },
    // And you can also ASSERT/ASSERTS the ACT result if needed
    ASSERT(res) {...},
    ASSERTS: {
        "assert 1"(res) {...},
        "assert 2"(res) {...}
    }
});
```

# Coverage
Coverages have sourcemaps enabled, branching enabled and exclude test files by default.

It also exclude `node_modules` by default. You can use the `--coverage-exclude REGEX` option to change the default exclusion regex. You can use multiple `--coverage-exclude REGEX` options.

To disable sourcemaps, you can use the `-coverage-no-source-maps` option.

To disable branching output, you can use the `-coverage-no-branches` option.

To run a coverage test, just add the `--coverage` argument, like so:
```ts
node myFile.test.js --coverage
npx aaa --coverage
npm test -- --coverage
```

You can ignore lines from the coverage file by using these comments:
```ts
/* coverage ignore next */ // This will ignore the next line (but not the line having this comment)
/* coverage ignore next 2*/ // This will ignore the next 2 lines (but not the line having this comment)
/* coverage disable */ // This will start ignoring all lines after this one (but not the line having this comment)
/* coverage enable */ // This will stop ignoring lines after this one
```
For example:
```ts
export function test(data:"a"|"b"|"c") {
    let res = 0;
    switch (data) {
        case "a": {
            res = 1;
            break;
        }
        case "b": {
            res = 2;
            break;
        }
        case "c": {
            res = 3;
            break;
        }
        default: { /* coverage ignore next 2 */
            throw new Error("Unreachable code") as typeof data as never; // Type-ensure that you do not forget any switch case
        }
    }
    return res;
}
```