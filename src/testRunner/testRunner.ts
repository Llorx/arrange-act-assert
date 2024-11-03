import * as UTIL from "util";

import { functionRunner, RunMonad } from "./functionRunner";
import { clearModuleCache, ResolvablePromise, resolvablePromise } from "../utils/utils";
import { Formatter, MessageType, Messages, TestInfo, TestType } from "../formatters";
import { DefaultFormatter } from "../formatters/default";
import { spawnTestFile, SpawnTestFileOptions } from "../spawnTestFile/spawnTestFile";

type AssertObject<ARR, ACT> = {[name:string]:(act:Awaited<ACT>, arrange:Awaited<ARR>, after:After)=>unknown};

type After = <T>(data:T, cb:(data:T)=>void) => T;

type DescribeCallback = (test:TestFunction, after:After)=>unknown;
export interface TestInterface<ARR, ACT, ASS> {
    ARRANGE?(after:After):ARR;
    ACT?(arrange:Awaited<NoInfer<ARR>>, after:After):ACT;
    ASSERT?(act:Awaited<NoInfer<ACT>>, arrange:Awaited<NoInfer<ARR>>, after:After):ASS;
    ASSERTS?:AssertObject<NoInfer<ARR>, NoInfer<ACT>>;
}
export type TestFunction = {
    <ARR, ACT, ASS>(description: string, testData: TestInterface<ARR, ACT, ASS>): Promise<void>;
    test:TestFunction;
    describe(description: string, cb: (test:TestFunction, after:After) => unknown): Promise<void>;
};
export type RunTestFileOptions = {
    clearModuleCache:boolean;
};

export type SummaryResult = {
    count:number;
    ok:number;
    error:number;
};
export type Summary = {
    test:SummaryResult;
    assert:SummaryResult;
    describe:SummaryResult;
    total:SummaryResult;
    failed: {fileId:string, id:number, test:TestInfo, error:string}[]
};

let ids = 0;
class Test<ARR = any, ACT = any, ASS = any> {
    private _promise = resolvablePromise();
    private _prendingPromise:ResolvablePromise|null = null;
    private _tests:Test[] = [];
    private _pending:Test[] = [];
    private _finished = false;
    private _afters:(()=>void)[] = [];
    private _testErrors:{test:Test, error:unknown}[] = [];
    readonly id = ids++;
    private _addAfter:After = (data, cb) => {
        this._afters.unshift(() => cb(data));
        return data;
    };
    constructor(readonly _send:(msg:Messages)=>void, readonly description:string, readonly data?:TestInterface<ARR, ACT, ASS>|DescribeCallback) {}
    async run() {
        try {
            try {
                this._send({
                    id: this.id,
                    type: MessageType.START
                });
                if (typeof this.data === "object") {
                    await this._runTest(this.data);
                } else {
                    await this._runDescribe(this.data);
                }
            } finally {
                await this.end();
            }
            const firstTestError = this._testErrors[0];
            if (firstTestError) {
                throw firstTestError.error;
            }
            this._send({
                id: this.id,
                type: MessageType.END
            });
            this._promise.resolve();
        } catch (e) {
            this._send({
                id: this.id,
                type: MessageType.END,
                error: UTIL.format(e)
            });
            this._promise.reject(e);
        }
        await this._promise;
    }
    async end() {
        this._finished = true;
        await this._awaitSubtests();
    }
    private _isDescribe() {
        return typeof this.data !== "object";
    }
    private _getAsserts() {
        if (typeof this.data === "object" && this.data.ASSERTS) {
            return Object.entries(this.data.ASSERTS);
        }
        return [];
    }
    describe(description:string, cb:DescribeCallback) {
        return this._add(description, cb);
    }
    test<ARR, ASS, ACT>(description:string, testData:TestInterface<ARR, ASS, ACT>) {
        return this._add(description, testData);
    }
    private _add<ARR, ASS, ACT>(description:string, testData:TestInterface<ARR, ASS, ACT>|DescribeCallback) {
        const test = new Test(this._send, description, testData);
        if (this._finished) {
            // TODO: Test this error in single and parallel
            test._promise.reject(new Error("This test is closed. Can't add new tests to it"));
        } else {
            this._tests.push(test);
            this._pending.push(test);
            this._send({
                id: test.id,
                type: MessageType.ADDED,
                test: {
                    parentId: this.id,
                    description: test.description,
                    type: test._isDescribe() ? TestType.DESCRIBE : TestType.TEST
                }
            });
            if (!this._prendingPromise) {
                this._runPending();
            }
        }
        return test._promise;
    }
    private async _runPending() {
        this._prendingPromise = resolvablePromise();
        while (true) {
            const test = this._pending.shift();
            if (!test) {
                break;
            }
            try {
                await test.run();
            } catch (error) {
                this._testErrors.push({ test, error });
            }
        }
        this._prendingPromise.resolve();
        this._prendingPromise = null;
    }
    private async _awaitSubtests() {
        await Promise.allSettled(this._tests.map(test => test._promise));
        if (this._prendingPromise) {
            await this._prendingPromise;
        }
    }
    private async _runDescribe(cb?:DescribeCallback) {
        const result = await functionRunner("describe", cb, [buildTestFunction(this), this._addAfter]);
        if (result.run && !result.ok) {
            throw result.error;
        }
    }
    private async _runTest(test:TestInterface<ARR, ACT, ASS>) {
        try {
            const arrangeResult = await functionRunner("ARRANGE", test.ARRANGE, [this._addAfter]);
            if (arrangeResult.run && !arrangeResult.ok) {
                throw arrangeResult.error;
            }
            const actResult = await functionRunner("ACT", test.ACT, [arrangeResult.data, this._addAfter]);
            if (actResult.run && !actResult.ok) {
                throw actResult.error;
            }
            if (test.ASSERT) {
                const id = ids++;
                this._send({
                    id: id,
                    type: MessageType.ADDED,
                    test: {
                        parentId: this.id,
                        description: "",
                        type: TestType.ASSERT
                    }
                });
                this._send({
                    id: id,
                    type: MessageType.START
                });
                const assertResult = await functionRunner("ASSERT", test.ASSERT, [actResult.data, arrangeResult.data, this._addAfter]);
                if (assertResult.run) {
                    if (!assertResult.ok) {
                        this._send({
                            id: id,
                            type: MessageType.END,
                            error: UTIL.format(assertResult.error)
                        });
                        throw assertResult.error;
                    }
                    this._send({
                        id: id,
                        type: MessageType.END
                    });
                }
            }
            let assertError:RunMonad<any>|null = null;
            for (const [description, cb] of this._getAsserts()) {
                // TODO: Test mutiple asserts
                const id = ids++;
                this._send({
                    id: id,
                    type: MessageType.ADDED,
                    test: {
                        parentId: this.id,
                        description: description,
                        type: TestType.ASSERT
                    }
                });
                this._send({
                    id: id,
                    type: MessageType.START
                });
                const assertResult = await functionRunner("ASSERT", cb, [actResult.data, arrangeResult.data, this._addAfter]);
                if (assertResult.run && !assertResult.ok) {
                    this._send({
                        id: id,
                        type: MessageType.END,
                        error: UTIL.format(assertResult.error)
                    });
                    if (!assertError) {
                        assertError = assertResult;
                    }
                } else {
                    this._send({
                        id: id,
                        type: MessageType.END
                    });
                }
            }
            if (assertError) {
                throw assertError.error;
            }
        } finally {
            const aftersResult = await this._runAfters();
            if (aftersResult && aftersResult.run && !aftersResult.ok) {
                throw aftersResult.error;
            }
        }
    }
    private async _runAfters():Promise<RunMonad<any>|null> {
        let doneError:RunMonad<any>|null = null;
        for (const cb of this._afters) {
            const afterResult = await functionRunner("AFTER", cb, []);
            if (afterResult.run && !afterResult.ok && !doneError) {
                doneError = afterResult;
            }
        }
        return doneError;
    }
}
class Root extends Test {
    formatter:Formatter|null = null;
    readonly summary:Summary = {
        test: {
            count: 0,
            ok: 0,
            error: 0
        },
        assert: {
            count: 0,
            ok: 0,
            error: 0
        },
        describe: {
            count: 0,
            ok: 0,
            error: 0
        },
        total: {
            count: 0,
            ok: 0,
            error: 0
        },
        failed: []
    };
    private _summaryMap = new Map<string, TestInfo>();
    constructor(readonly notifyParentProcess:((msg:{type:"testRunner", data:Messages})=>void)|null) {
        super(msg => this.processMessage("", msg), "");
    }
    processMessage(fileId:string, msg:Messages) {
        if ("id" in msg && msg.id === this.id) {
            return; // Root doesn't notify
        }
        switch(msg.type) {
            case MessageType.ADDED: {
                const id = `${fileId}_${msg.id}`;
                switch (msg.test.type) {
                    case TestType.TEST: {
                        this.summary.test.count++;
                        break;
                    }
                    case TestType.DESCRIBE: {
                        this.summary.describe.count++;
                        break;
                    }
                    case TestType.ASSERT: {
                        this.summary.assert.count++;
                        break;
                    }
                }
                this.summary.total.count++;
                this._summaryMap.set(id, msg.test);
                break;
            }
            case MessageType.END: {
                const id = `${fileId}_${msg.id}`;
                const test = this._summaryMap.get(id);
                if (test) {
                    if (msg.error) {
                        switch (test.type) {
                            case TestType.TEST: {
                                this.summary.test.error++;
                                break;
                            }
                            case TestType.DESCRIBE: {
                                this.summary.describe.error++;
                                break;
                            }
                            case TestType.ASSERT: {
                                this.summary.assert.error++;
                                break;
                            }
                        }
                        this.summary.total.error++;
                        this.summary.failed.push({ fileId: fileId, id: msg.id, test: test, error: msg.error });
                    } else {
                        switch (test.type) {
                            case TestType.TEST: {
                                this.summary.test.ok++;
                                break;
                            }
                            case TestType.DESCRIBE: {
                                this.summary.describe.ok++;
                                break;
                            }
                            case TestType.ASSERT: {
                                this.summary.assert.ok++;
                                break;
                            }
                        }
                        this.summary.total.ok++;
                    }
                }
                break;
            }
        }
        if (this.formatter) {
            this.formatter.format(fileId, msg);
        } else {
            if (typeof process === "undefined") {
                global.process = {} as any;
            }
            if (this.notifyParentProcess) {
                this.notifyParentProcess({
                    type: "testRunner",
                    data: msg
                });
            } else {
                if (!this.formatter) {
                    this.formatter = new DefaultFormatter();
                }
                this.formatter.format(fileId, msg);
            }
        }
    }
    setFormatter(formatter:Formatter) {
        this.formatter = formatter;
    }
    runTestFile(file:string, options:RunTestFileOptions) {
        if (options.clearModuleCache) {
            clearModuleCache(file);
        }
        return require(file);
    }
    async spawnTestFile(file:string, options:SpawnTestFileOptions) {
        this.processMessage(file, {
            type: MessageType.FILE_START
        });
        try {
            await spawnTestFile(file, options, msg => {
                if (isMessage(msg)) {
                    this.processMessage(file, msg.data);
                }
            });
        } finally {
            this.processMessage(file, {
                type: MessageType.FILE_END
            });
        }
    }
}
export function isMessage(msg:unknown):msg is { data: Messages } {
    return !!msg && typeof msg === "object" && "type" in msg && msg.type === "testRunner" && "data" in msg;
}

let root:Root|null;
function getRoot() {
    if (root) {
        return root;
    } else {
        // Not a suite in this process (for example running a test file directly)
        // So run tests and show errors if needed
        // TODO: Test run single file without suite, newRoot or anything
        const myRoot = newRoot();
        setImmediate(() => {
            myRoot.run().catch((e) => {
                process.exitCode = 1111;
                if (!myRoot.formatter || !myRoot.formatter.formatSummary) {
                    console.error(e);
                }
            }).finally(() => {
                if (myRoot.formatter && myRoot.formatter.formatSummary) {
                    myRoot.formatter.formatSummary(myRoot.summary);
                }
                root = null; // Reset root, just in case another test is added in this process
            });
        });
        return myRoot;
    }
}
function buildTestFunction(myTest:Test|null):TestFunction {
    function test<ARR, ACT, ASS>(description:string, testData:TestInterface<ARR, ACT, ASS>) {
        return (myTest || getRoot()).test(description, testData);
    }
    test.test = test;
    test.describe = function describe(description:string, cb:DescribeCallback) {
        return (myTest || getRoot()).describe(description, cb);
    };
    return test;
}

export function newRoot() {
    // Check notifyParentProcess inside of the function so can be reset during testing
    const notifyParentProcess = process.env.AAA_TEST_FILE && process.send && process.send.bind(process) || null;
    return root = new Root(notifyParentProcess);
}

if (process.env.AAA_TEST_FILE && process.send) {
    // Create a root file when running inside a test suite child process
    newRoot();
}

export default buildTestFunction(null);
export type { Test };