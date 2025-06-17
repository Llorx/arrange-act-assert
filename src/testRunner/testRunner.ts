import * as Util from "util";
import * as Path from "path";
import * as Fs from "fs";
import * as V8 from "v8";
import * as Assert from "assert";
import * as Crypto from "crypto";

import { functionRunner, RunMonad } from "./functionRunner";
import { clearModuleCache, getTestOptions, ResolvablePromise, resolvablePromise, getCallSites } from "../utils/utils";
import { Formatter, MessageType, Messages, TestInfo, TestType } from "../formatters";
import { DefaultFormatter } from "../formatters/default";
import { spawnTestFile, SpawnTestFileOptions } from "../spawnTestFile/spawnTestFile";
import coverage from "../coverage/singleton";

type AssertSnapshotObject<ARR, ACT> = {[name:string]:(act:Awaited<ACT>, arrange:Awaited<ARR>, after:After)=>unknown};

export type After = <T>(data:T, cb:(data:T)=>void) => T;

export type DescribeCallback = (test:TestFunction, after:After)=>unknown;
export type TestInterface<ARR, ACT, ASS> = {
    ARRANGE?(after:After):ARR;
    ACT?(arrange:Awaited<NoInfer<ARR>>, after:After):ACT;
    ASSERT?(act:Awaited<NoInfer<ACT>>, arrange:Awaited<NoInfer<ARR>>, after:After):ASS;
    ASSERTS?:AssertSnapshotObject<NoInfer<ARR>, NoInfer<ACT>>;
    SNAPSHOTS?:AssertSnapshotObject<NoInfer<ARR>, NoInfer<ACT>>;
} | {
    ARRANGE?(after:After):ARR;
    SNAPSHOT?(arrange:Awaited<NoInfer<ARR>>, after:After):ACT;
    ASSERT?(act:Awaited<NoInfer<ACT>>, arrange:Awaited<NoInfer<ARR>>, after:After):ASS;
    ASSERTS?:AssertSnapshotObject<NoInfer<ARR>, NoInfer<ACT>>;
};

export type TestFunction = {
    <ARR, ACT, ASS>(description:string, testData:TestInterface<ARR, ACT, ASS>):Promise<void>;
    test:TestFunction;
    describe(description:string, cb:(test:TestFunction, after:After)=>unknown):Promise<void>;
    after(cb:()=>void):void;
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
    failed:{
        fileId:string;
        id:number;
        test:TestInfo;
        error:string
    }[];
};
export type TestOptions = {
    snapshotsFolder?:string;
    confirmSnapshots?:boolean;
    reviewSnapshots?:boolean;
    regenerateSnapshots?:boolean;
    coverage?:boolean;
    coverageExclude?:RegExp[];
    coverageNoBranches?:boolean;
    disableSourceMaps?:boolean;
};
type FullTestOptions = {
    description:string;
    descriptionPath:string[];
} & Required<TestOptions>;
type TestContext = {
    send:(msg:Messages)=>void;
    readFile(path:string):Promise<Buffer>;
    writeFile(path:string, data:Buffer):Promise<void>;
};
type Snapshot = {
    validated:boolean;
    data:unknown;
};
const VALID_NAME_REGEX = /[^\w\-. ]/g;

let ids = 0;
class Test<ARR = any, ACT = any, ASS = any> {
    private _promise = resolvablePromise();
    private _pendingPromise:ResolvablePromise|null = null;
    private _tests:Test[] = [];
    private _pending:Test[] = [];
    private _finished = false;
    private _ended = false;
    private _afters:(()=>void)[] = [];
    private _afterTest:(()=>void)[] = [];
    private _testErrors:{test:Test, error:unknown}[] = [];
    readonly id = ids++;
    private _addAfter:After = (data, cb) => {
        this._afters.unshift(() => cb(data));
        return data;
    };
    constructor(private _context:TestContext, private _options:FullTestOptions, readonly data?:TestInterface<ARR, ACT, ASS>|DescribeCallback) {}
    async run() {
        try {
            if (this._options.coverage) {
                await coverage.start();
            }
            try {
                this._context.send({
                    id: this.id,
                    type: MessageType.START
                });
                if (typeof this.data === "object") {
                    await this._runTest(this.data);
                } else {
                    await this._runDescribe(this.data);
                }
            } finally {
                try {
                    await this._runAfters();
                } finally {
                    try {
                        await this.end();
                    } finally {
                        await this._runAfterTests();
                    }
                }
            }
            const firstTestError = this._testErrors[0];
            if (firstTestError) {
                throw firstTestError.error;
            }
            this._context.send({
                id: this.id,
                type: MessageType.END
            });
            this._promise.resolve();
        } catch (e) {
            this._context.send({
                id: this.id,
                type: MessageType.END,
                error: Util.format(e)
            });
            this._promise.reject(e);
        }
        await this._promise;
    }
    async end() {
        this._finished = true;
        await this._awaitSubtests();
        this._ended = true;
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
    private _getSnapshots() {
        if (typeof this.data === "object" && "SNAPSHOTS" in this.data && this.data.SNAPSHOTS) {
            return Object.entries(this.data.SNAPSHOTS);
        }
        return [];
    }
    describe(description:string, cb:DescribeCallback) {
        return this._add(description, cb);
    }
    test<ARR, ASS, ACT>(description:string, testData:TestInterface<ARR, ASS, ACT>) {
        return this._add(description, testData);
    }
    after(cb:()=>void) {
        if (this._ended) {
            cb();
        } else {
            this._afterTest.push(cb);
        }
    }
    private _add<ARR, ASS, ACT>(description:string, testData:TestInterface<ARR, ASS, ACT>|DescribeCallback) {
        const test = new Test(this._context, {
            ...this._options,
            description: description,
            descriptionPath: [...this._options.descriptionPath, description]
        }, testData);
        if (this._finished) {
            // TODO: Test this error in single and parallel
            test._promise.reject(new Error("This test is closed. Can't add new tests to it"));
        } else {
            this._tests.push(test);
            this._pending.push(test);
            this._context.send({
                id: test.id,
                type: MessageType.ADDED,
                test: {
                    parentId: this.id,
                    description: description,
                    type: test._isDescribe() ? TestType.DESCRIBE : TestType.TEST
                }
            });
            if (!this._pendingPromise) {
                this._runPending();
            }
        }
        return test._promise;
    }
    private async _runPending() {
        this._pendingPromise = resolvablePromise();
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
        this._pendingPromise.resolve();
        this._pendingPromise = null;
        try {
            await this._runAfterTests();
        } catch (error) {
            this._testErrors.push({ test: this, error });
        }
    }
    private async _awaitSubtests() {
        await Promise.allSettled(this._tests.map(test => test._promise));
        if (this._pendingPromise) {
            await this._pendingPromise;
        }
    }
    private async _runDescribe(cb?:DescribeCallback) {
        const result = await functionRunner("describe", cb || null, [buildTestFunction(this), this._addAfter]);
        if (result.run && !result.ok) {
            throw result.error;
        }
    }
    private async _checkSnapshot(testData:unknown, description?:string) {
        const path = [...this._options.descriptionPath, description || ""];
        const cleanPath = path.map(name => name.replace(VALID_NAME_REGEX, "_"));
        const hash = Crypto.createHash("shake128", { outputLength: 4 }).update(path.join("·")).digest("hex");
        const file = `${Path.join(this._options.snapshotsFolder, ...cleanPath).substring(0, 246)}.${hash}`; // Maximum 255 characters (246 + dot + 4 hex bytes (8))
        if (this._options.reviewSnapshots) {
            throw new Error(`Review snapshot: ${file}\nValue: ${Util.inspect(testData, false, Infinity, false)}`);
        }
        let fileData;
        try {
            fileData = !this._options.regenerateSnapshots && await this._context.readFile(file);
        } catch (e) {}
        if (fileData) {
            const snapshot = V8.deserialize(fileData) as Snapshot;
            if (snapshot.validated && !this._options.regenerateSnapshots) {
                Assert.deepStrictEqual(testData, snapshot.data);
            } else if (this._options.confirmSnapshots) {
                Assert.deepStrictEqual(testData, snapshot.data);
                snapshot.validated = true;
                await this._context.writeFile(file, V8.serialize(snapshot));
            } else {
                // If object is validated or is not equal, rewrite the file
                if (snapshot.validated) {
                    snapshot.validated = false;
                    snapshot.data = testData;
                    await this._context.writeFile(file, V8.serialize(snapshot));
                } else {
                    try {
                        Assert.deepStrictEqual(testData, snapshot.data);
                    } catch (e) {
                        snapshot.data = testData;
                        await this._context.writeFile(file, V8.serialize(snapshot));
                    }
                }
                throw new Error(`Confirm snapshot: ${file}\nValue: ${Util.inspect(testData, false, Infinity, false)}`);
            }
        } else if (!this._options.confirmSnapshots) {
            const snapshot:Snapshot = {
                validated: false,
                data: testData
            };
            await this._context.writeFile(file, V8.serialize(snapshot));
            throw new Error(`Confirm snapshot: ${file}\nValue: ${Util.inspect(testData, false, Infinity, false)}`);
        } else {
            throw new Error("No snapshot file found. First run without confirmation to validate the snapshots");
        }
    }
    private async _runAssert<ARGS extends any[], RES>(cb:((...args:ARGS)=>RES)|null, args:[...ARGS], description?:string) {
        if (cb) {
            const id = ids++;
            this._context.send({
                id: id,
                type: MessageType.ADDED,
                test: {
                    parentId: this.id,
                    description: description || "",
                    type: TestType.ASSERT
                }
            });
            this._context.send({
                id: id,
                type: MessageType.START
            });
            const assertResult = await functionRunner("ASSERT", cb, args);
            if (assertResult.run) {
                if (!assertResult.ok) {
                    this._context.send({
                        id: id,
                        type: MessageType.END,
                        error: Util.format(assertResult.error)
                    });
                    throw assertResult.error;
                }
                this._context.send({
                    id: id,
                    type: MessageType.END
                });
            }
        }
        return functionRunner("ASSERT", null, []); // Always return a RunMonad
    }
    private async _runSnapshot<ARGS extends any[], RES>(cb:((...args:ARGS)=>RES)|null, args:[...ARGS], description?:string):Promise<RunMonad<Awaited<RES>>> {
        if (cb) {
            const id = ids++;
            this._context.send({
                id: id,
                type: MessageType.ADDED,
                test: {
                    parentId: this.id,
                    description: description || "",
                    type: TestType.ASSERT
                }
            });
            this._context.send({
                id: id,
                type: MessageType.START
            });
            const res = await functionRunner("SNAPSHOT", cb && (async () => {
                const result = await cb(...args);
                await this._checkSnapshot(result, description);
                return result;
            }), []);
            if (res.run && !res.ok) {
                this._context.send({
                    id: id,
                    type: MessageType.END,
                    error: Util.format(res.error)
                });
            } else {
                this._context.send({
                    id: id,
                    type: MessageType.END
                });
            }
            return res;
        }
        return functionRunner("SNAPSHOT", null, []); // Always return a RunMonad
    }
    private async _runTest(test:TestInterface<ARR, ACT, ASS>) {
        const arrangeResult = await functionRunner("ARRANGE", test.ARRANGE || null, [this._addAfter]);
        if (arrangeResult.run && !arrangeResult.ok) {
            throw arrangeResult.error;
        }
        const actResult = await functionRunner("ACT", "ACT" in test && test.ACT || null, [arrangeResult.data, this._addAfter]);
        let actResultData;
        let snapshotResult;
        if (actResult.run) {
            if (!actResult.ok) {
                throw actResult.error;
            }
            actResultData = actResult.data;
        } else {
            snapshotResult = await this._runSnapshot("SNAPSHOT" in test && test.SNAPSHOT || null, [arrangeResult.data, this._addAfter]);
            if (snapshotResult.run && !snapshotResult.ok) {
                throw snapshotResult.error;
            }
            actResultData = snapshotResult.data;
        }
        if (test.ASSERT) {
            const assertResult = await this._runAssert(test.ASSERT, [actResultData, arrangeResult.data, this._addAfter]);
            if (assertResult.run && !assertResult.ok) {
                throw assertResult.error;
            }
        }
        let assertError = null;
        if (!snapshotResult || !snapshotResult.run) {
            for (const [description, cb] of this._getSnapshots()) {
                // TODO: Test multiple SNAPSHOTS
                const snapshotResult = await this._runSnapshot(cb, [actResultData, arrangeResult.data, this._addAfter], description);
                if (snapshotResult.run && !snapshotResult.ok && !assertError) {
                    assertError = snapshotResult;
                }
            }
        }
        for (const [description, cb] of this._getAsserts()) {
            // TODO: Test mutiple ASSERTS
            const assertResult = await this._runAssert(cb, [actResultData, arrangeResult.data, this._addAfter], description);
            if (assertResult.run && !assertResult.ok && !assertError) {
                assertError = assertResult;
            }
        }
        if (assertError) {
            throw assertError.error;
        }
    }
    private async _runAfters():Promise<void> {
        let doneError:RunMonad<any>|null = null;
        for (const cb of this._afters.splice(0)) {
            const afterResult = await functionRunner("AFTER", cb, []);
            if (afterResult.run && !afterResult.ok && !doneError) {
                doneError = afterResult;
            }
        }
        if (doneError && doneError.run && !doneError.ok) {
            throw doneError.error;
        }
    }
    private async _runAfterTests():Promise<void> {
        let doneError:RunMonad<any>|null = null;
        for (const cb of this._afterTest.splice(0)) {
            const afterResult = await functionRunner("AFTER TEST", cb, []);
            if (afterResult.run && !afterResult.ok && !doneError) {
                doneError = afterResult;
            }
        }
        if (doneError && doneError.run && !doneError.ok) {
            throw doneError.error;
        }
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
    constructor(
        readonly notifyParentProcess:((msg:{type:"testRunner", data:Messages})=>void)|null, options?:TestOptions) {
        super({
            send: msg => this.processMessage("", msg),
            readFile: file => Fs.promises.readFile(file),
            async writeFile(path, data) {
                await Fs.promises.mkdir(Path.dirname(path), { recursive: true });
                await Fs.promises.writeFile(path, data);
            }
        }, {
            descriptionPath: [],
            description: "",
            snapshotsFolder: Path.join(process.cwd(), "snapshots"),
            confirmSnapshots: false,
            reviewSnapshots: false,
            regenerateSnapshots: false,
            coverage: false,
            coverageExclude: [],
            coverageNoBranches: false,
            disableSourceMaps: false,
            ...options
        });
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

const testOptions:Partial<TestOptions> = process.env.AAA_TEST_OPTIONS ? JSON.parse(process.env.AAA_TEST_OPTIONS) : getTestOptions();
let root:Root|null;
const files = new Set<string>();
function addTestFiles() {
    for (const file of getCallSites()) {
        files.add(file);
    }
}
function getRoot() {
    if (root) {
        return root;
    } else {
        const myRoot = newRoot(testOptions);
        setImmediate(() => {
            myRoot.run().catch((e) => {
                process.exitCode = 1111;
                if (!myRoot.formatter || !myRoot.formatter.formatSummary) {
                    console.error(e);
                }
            }).finally(async () => {
                if (testOptions.coverage) {
                    myRoot.processMessage("", {
                        type: MessageType.COVERAGE,
                        coverage: await coverage.takeCoverage()
                    });
                }
                if (myRoot.formatter && myRoot.formatter.formatSummary) {
                    myRoot.formatter.formatSummary(myRoot.summary, {
                        excludeFiles: Array.from(files),
                        exclude: testOptions.coverageExclude || [/\/node_modules\//i],
                        branches: !testOptions.coverageNoBranches,
                        sourceMaps: !testOptions.disableSourceMaps
                    });
                }
                root = null; // Reset root, just in case another test is added in this process, so root restarts again
            });
        });
        return myRoot;
    }
}
function buildTestFunction(myTest:Test|null):TestFunction {
    function test<ARR, ACT, ASS>(description:string, testData:TestInterface<ARR, ACT, ASS>) {
        addTestFiles();
        return (myTest || getRoot()).test(description, testData);
    }
    test.test = test;
    test.describe = function describe(description:string, cb:DescribeCallback) {
        addTestFiles();
        return (myTest || getRoot()).describe(description, cb);
    };
    test.after = function after(cb:()=>void) {
        addTestFiles();
        return (myTest || getRoot()).after(cb);
    };
    return test;
}

export function newRoot(options?:TestOptions) {
    addTestFiles();
    // Check notifyParentProcess inside of the function so can be reset during testing
    const notifyParentProcess = process.env.AAA_TEST_FILE && process.send && process.send.bind(process) || null;
    return root = new Root(notifyParentProcess, options);
}

export default buildTestFunction(null);
export type { Test };