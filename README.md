# arrange-act-assert
Act-Arrange-Assert oriented testing tool.
Read the **UPDATED DOCUMENTATION** in GitHub: https://github.com/Llorx/arrange-act-assert

# Motivation
Focusing lately in unitary testing, I noticed that I wanted to reduce the amount of *brain cycles* that I waste designing and reading tests, so I started adding `// Act // Arrange // Assert` [comments to all my tests](https://github.com/goldbergyoni/javascript-testing-best-practices?tab=readme-ov-file#section-0%EF%B8%8F%E2%83%A3-the-golden-rule) so it helps me to notice when something is not in the proper section and also helps identifying each section on first sight, but there's a thing I love more than testing: design-oriented development. Humans are fallible so I prefer for the tool or project premise to force me to follow methodologies and good practices instead of me applying my own rules over my workflow. The more good practices you are forced to do, the less chances to have a problem because, for example, you had a headache one day and you didn't notice a mistake.

With this idea, I created the Act-Arrange-Assert testing tool that reduces the amount of *brain cycles* wasted when you have to read and design your tests.

For example, having this test using NodeJS test runner:
```typescript
import test from "node:test";
import Assert from "node:assert";

import { MyFactory } from "./MyFactory";
import { MyBase } from "./MyBase";

test("should do that thing properly", () => {
    const baseOptions = {
        a: 1,
        b: 2,
        c: 3,
        d: 4
    };
    const base = new MyBase(baseOptions);
    base.open();
    test.after(() => base.close());
    base.setData("a", 2);
    const factory = new MyFactory();
    test.after(() => factory.dispose());
    const processor = factory.getProcessor();
    const data = processor.processBase(base);
    Assert.deepScriptEqual(data, {
        a: 2,
        b: 27
    });
});
```
Try to read and understand the different implicit sections. You notice how you had to spend *brain cycles* to understand it. To improve this test I would do something like this:
```typescript
import test from "node:test";
import Assert from "node:assert";

import { MyFactory } from "./MyFactory";
import { MyBase } from "./MyBase";

test("should do that thing properly", () => {
    // Arrange
    const baseOptions = {
        a: 1,
        b: 2,
        c: 3,
        d: 4
    };
    const base = new MyBase(baseOptions);
    test.after(() => base.close());
    base.open();
    base.setData("a", 2);
    const factory = new MyFactory();
    test.after(() => factory.dispose());
    const processor = factory.getProcessor();
    // Act
    const data = processor.processBase(base);
    // Assert
    Assert.deepScriptEqual(data, {
        a: 2,
        b: 27
    });
});
```
This helps to differenciate the sections, for example helping you to avoid mixing the the `// Act` and `// Assert` sections like this:
```typescript
Assert.deepScriptEqual(processor.processBase(base), {...}); // Bad
```
Still I don't like the idea of just using comments, because that's a rule I've set to myself. The tool itself stills allows me to do weird things that maybe some day I do for whatever reason.

With `arrange-act-assert` it helps design a test like this:
```typescript
import test from "arrange-act-assert";
import Assert from "node:assert";

import { MyFactory } from "./MyFactory";
import { MyBase } from "./MyBase";

test("should do that thing properly", {
    ARRANGE(after) {
        const baseOptions = {
            a: 1,
            b: 2,
            c: 3,
            d: 4
        };
        const base = after(new MyBase(baseOptions), item => item.close());
        base.open();
        base.setData("a", 2);
        const factory = after(new MyFactory(), item => item.close());
        const processor = factory.getProcessor();
        return { base, processor };
    },
    ACT({ base, processor }) {
        return processor.processBase(base);
    },
    ASSERT(data) {
        Assert.deepScriptEqual(data, {
            a: 2,
            b: 27
        });
    }
});
```
If you actually read the code, I bet that one of the first things that you saw were the uppercase sections. I can hear you screaming "ugh those uppercase section names!" and that's precisely my pitch: they're noticeable, they're easy to see, THEY'RE UPPERCASE, so you wasted almost no *brain cycles* identifying them.

The tool, by design, helped you to differenciate the method that you are trying to test (the `processBase()` inside the ACT) and what result it should return (the `{ a: 2, b: 27 }` inside the ASSERT).

Apart from that, the `after` callback has a different approach. It wraps the item to be cleared and returns it in the callback function. This way the item to be cleared is directly linked to the callback that will clear it.

And that's very much it.

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
        // Receives what ARRANGE returns as the first argument
        // Receives an "after" callback as the second argument
        const myAct = myArrange + 1;
        return { myAct };
    },
    ASSERT?({ myAct }, { myArrange }, after) {
        // Optional ASSERT method
        // Receives what ACT returns as the first argument
        // Receives what ARRANGE returns as the second argument
        // Receives an "after" callback as the third argument
        myAct === 101;
        myArrange === 100;
    },
    ASSERTS?: {
        // Optional ASSERTS object just in case that you need to
        // check multiple results for the same action, to
        // avoid having a single ASSERT section with multiple assertions
        "should assert one thing"({ myAct }, { myArrange }, after) {
            // Receives what ACT returns as the first argument
            // Receives what ARRANGE returns as the second argument
            // Receives an "after" callback as the third argument
            myAct === 101;
            myArrange === 100;
        },
        "should assert another thing"({ myAct }, { myArrange }, after) {
            // Receives what ACT returns as the first argument
            // Receives what ARRANGE returns as the second argument
            // Receives an "after" callback as the third argument
            myAct === 101;
            myArrange === 100;
        }
    }
});
```
All three methods are optional, because you don't need to arrange anything, or maybe you only want to test that the ACT doesn't throw an error.

You also have a `describe` to group tests:
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
    // Use the new "test" function
    test.describe("subdescribe 1", (test) => {
        // Use the new "test" function
        test("myTest1", {...});
        test("myTest2", {...});
    });
    test.describe("subdescribe 2", (test) => {
        // Use the new "test" function
        test("myTest1", {...});
        test("myTest2", {...});
    });
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
· `--folder STRING`: The path of the folder where the test files are located. Defaults to the current folder.
· `--parallel NUMBER`: This tool runs test files in subprocesses (one new node process per test file). It will run these amounts of files in parallel. Set to `0` to run all the test files in the very same process, although is not recommended. Defaults to the amount of cores that the running computer has.
· `--include-files REGEX`: The regex to apply to each full file path found to consider it a test file to run. You can set multiple regexes by setting this option multiple times. Defaults to `(\\|\/|.*(\.|-|_))(test)(\.|(\.|-|\\|\/).*.)(cjs|mjs|js)$`.
· `--exclude-files REGEX`: The regex to apply to each full file path found to exclude it. Defaults to `\/node_modules\/`.
· `--spawn-args-prefix PREFIX`: It will launch the test files with this prefix in the arguments. You can set multiple prefixes by setting this option multiple times.
· `--clear-module-cache`: When you run test files with `parallel` set to `0` (same process), this flag will delete the module cache so when the TestSuite requires a test file, NodeJS will re-require and re-evaluate the file and its dependencies instead of returning the cache, just in case that you need everything clean.

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
To assert errors, you can use the `monad` and `asyncMonad` utils:
```typescript
import { test, monad, asyncMonad } from "arrange-act-assert";

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
        return await asyncMonad(async () => await thing(-1));
    },
    ASSERT(res) {
        res.should.error({
            message: "Argument must be >= 0"
        });
    }
});
```
They will return a `Monad` object with the properties `ok` and `error` and the methods `should.ok(VALUE)` and `should.error(ERROR)`. The error validation is done using the [NodeJS Assert.throws() error argument](https://nodejs.org/api/assert.html#assertthrowsfn-error-message).