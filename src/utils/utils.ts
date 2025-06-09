import * as Util from "util";
import * as Path from "path";
import type { TestOptions } from "../testRunner/testRunner";
import type { TestSuiteOptions } from "../TestSuite/TestSuite";

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
    const coverageExclude = args.get("coverage-exclude");
    if (coverageExclude != null) {
        options.coverageExclude = coverageExclude.map(filter => new RegExp(filter));
    }
    const coverageNoBranches = args.get("coverage-no-branches");
    if (coverageNoBranches != null) {
        options.coverageNoBranches = true;
    }
    const snapshotsFolder = args.get("snapshots-folder");
    if (snapshotsFolder) {
        if (snapshotsFolder.length === 0) {
            throw new Error(`--snapshots-folder needs a value`);
        } else if (snapshotsFolder.length > 1 || !snapshotsFolder[0]) {
            throw new Error(`Only one --snapshots-folder argument is allowed`);
        }
        options.snapshotsFolder = snapshotsFolder[0];
    }
    const confirmSnapshots = args.get("snapshots-confirm");
    if (confirmSnapshots) {
        options.confirmSnapshots = true;
    }
    const reviewSnapshots = args.get("snapshots-review");
    if (reviewSnapshots) {
        options.reviewSnapshots = true;
    }
    const regenerateSnapshots = args.get("snapshots-regenerate");
    if (regenerateSnapshots) {
        options.regenerateSnapshots = true;
    }
    const coverage = args.get("coverage");
    if (coverage) {
        options.coverage = true;
    }
    return options;
}
export function getCallSites() {
    let callsite:string[] = [];
    try {
        callsite = (Util as any).getCallSites().map((callSite:Util.StacktraceObject) => callSite.scriptName); // node > 22
    } catch (e) {
        try {
            callsite = Util.getCallSite().map(callSite => callSite.scriptName); // node == 22
        } catch (e) {
            // node < 22
            const prepareStackTrace = Error.prepareStackTrace;
            try {
                Error.prepareStackTrace = (_, callSites) => callSites.map(callSite => callSite.getFileName());
                callsite = new Error().stack as unknown as string[];
            } finally {
                Error.prepareStackTrace = prepareStackTrace;
            }
        }
    }
    return callsite;
}
export function testRegex(path:string, regex:RegExp[]) {
    const fullPathForward = path.replace(/\\/g, "/");
    const fullPathBackward = path.replace(/\//g, "\\");
    for (const r of regex) {
        if (r.test(fullPathForward) || r.test(fullPathBackward)) {
            return true;
        }
    }
    return false;
}
export function getCommonBasePath(files:string[]) {
    let maxI = Infinity;
    const splitFiles = files.map(file => {
        const paths = file.split(Path.sep);
        if (paths.length - 1 < maxI) {
            maxI = paths.length - 1; // - 1 to avoid filtering the filename
        }
        return paths;
    });
    if (splitFiles.length > 0) {
        const commonBase:string[] = [];
        loop: for (let i = 0; i < maxI; i++) {
            let base:string|null = null;
            for (const file of splitFiles) {
                if (base == null) {
                    base = file[i]!;
                } else if (file[i] !== base) {
                    break loop
                }
            }
            commonBase.push(base!);
        }
        if (commonBase.length > 0) {
            if (commonBase[commonBase.length -1] !== "") {
                commonBase.push("");
            }
            return commonBase.join(Path.sep);
        }
    }
    return "";
}