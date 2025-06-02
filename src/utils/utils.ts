import * as Path from "path";
import { TestOptions } from "../testRunner/testRunner";
import { TestSuiteOptions } from "../TestSuite/TestSuite";

export interface ResolvablePromise extends Promise<void> {
    resolve():void;
    reject(error:unknown):void;
}

export function resolvablePromise() {
    let rejected = false;
    let resolved = false;
    let resolve:()=>void;
    let reject:(err:unknown)=>void;
    const instance = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    }) as ResolvablePromise;
    instance.resolve = () => {
        if (resolved || rejected) {
            return;
        }
        resolved = true;
        resolve();
    };
    instance.reject = (e:unknown) => {
        if (resolved) {
            throw new Error("Already resolved");
        }
        if (rejected) {
            return;
        }
        rejected = true;
        reject(e);
    };
    return instance;
}

export function clearModuleCache(file:string, _root = Path.dirname(file) + Path.sep) {
    const id = require.resolve(file);
    if (Object.hasOwnProperty.call(require.cache, id)) {
        const mod = require.cache[id];
        if (mod && mod.id.startsWith(_root)) {
            delete require.cache[id];
            for (const child of mod.children) {
                clearModuleCache(child.id, _root);
            }
        }
    }
}

function processArgs(args:string[]) {
    let nextKey = "";
    const res = new Map<string, string[]>();
    for (const arg of args) {
        if (arg.startsWith("--")) {
            if (nextKey && !res.has(nextKey)) {
                res.set(nextKey, []);
            }
            nextKey = arg.slice(2);
            const equalIndex = nextKey.indexOf("=");
            if (equalIndex > -1) {
                const value = nextKey.substring(equalIndex + 1);
                nextKey = nextKey.substring(0, equalIndex);
                const values = res.get(nextKey);
                if (values) {
                    values.push(value);
                } else {
                    res.set(nextKey, [value]);
                }
                nextKey = "";
            }
        } else if (nextKey) {
            const values = res.get(nextKey);
            if (values) {
                values.push(arg);
            } else {
                res.set(nextKey, [arg]);
            }
        }
    }
    if (nextKey && !res.has(nextKey)) {
        res.set(nextKey, []);
    }
    return res;
}
export function getTestSuiteOptions(argv = process.argv):Partial<TestSuiteOptions> {
    const args = processArgs(argv);
    const options:Partial<TestSuiteOptions> = {};
    const folder = args.get("folder");
    if (folder) {
        if (folder.length === 0) {
            throw new Error(`--folder needs a value`);
        } else if (folder.length > 1 || !folder[0]) {
            throw new Error(`Only one --folder argument is allowed`);
        }
        options.folder = folder[0];
    }
    const parallel = args.get("parallel");
    if (parallel != null) {
        if (parallel.length === 0) {
            throw new Error(`--parallel needs a value`);
        } else if (parallel.length > 1 || !parallel[0]) {
            throw new Error(`Only one --parallel argument is allowed`);
        }
        const parallelNumber = Number(parallel[0]);
        if (!Number.isFinite(parallelNumber)) {
            throw new Error(`--parallel must be a number: ${parallel[0]}`);
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
    return {
        ...options,
        ...getTestOptions(argv)
    };
}
export function getTestOptions(argv = process.argv) {
    const args = processArgs(argv);
    const options:Partial<TestOptions> = {};
    const snapshotsFolder = args.get("snapshots-folder");
    if (snapshotsFolder) {
        if (snapshotsFolder.length === 0) {
            throw new Error(`--snapshots-folder needs a value`);
        } else if (snapshotsFolder.length > 1 || !snapshotsFolder[0]) {
            throw new Error(`Only one --snapshots-folder argument is allowed`);
        }
        options.snapshotsFolder = snapshotsFolder[0];
    }
    const confirmSnapshots = args.get("confirm-snapshots");
    if (confirmSnapshots) {
        options.confirmSnapshots = true;
    }
    const reviewSnapshots = args.get("review-snapshots");
    if (reviewSnapshots) {
        options.reviewSnapshots = true;
    }
    return options;
}