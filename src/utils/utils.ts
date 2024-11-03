import * as PATH from "path";

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

export function clearModuleCache(file:string, _root = PATH.dirname(file) + PATH.sep) {
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

export function processArgs(args:string[]) {
    // TODO: Test this
    let nextKey = "";
    const res = new Map<string, string[]>();
    for (const arg of args) {
        if (arg.startsWith("--")) {
            if (nextKey) {
                const values = res.get(nextKey);
                if (values) {
                    values.push("");
                } else {
                    res.set(nextKey, [""]);
                }
            }
            nextKey = arg.slice(2);
        } else if (nextKey) {
            const values = res.get(nextKey);
            if (values) {
                values.push(arg);
            } else {
                res.set(nextKey, [arg]);
            }
            nextKey = "";
        } else {
            throw new Error(`Invalid argument: ${arg}`);
        }
    }
    if (nextKey) {
        const values = res.get(nextKey);
        if (values) {
            values.push("");
        } else {
            res.set(nextKey, [""]);
        }
    }
    return res;
}