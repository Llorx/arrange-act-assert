import * as Assert from "assert";

type MonadObject<T> = {
    ok:T;
} | {
    error:unknown;
};
export type Monad<T> = {
    unwrap():T;
    match(match:{
        ok(value:T):void;
        error(error:unknown):void;
    }):void;
    should:{
        ok(value:T):void;
        error(error:Assert.AssertPredicate):void;
    }
};
function monadify<T>(res:MonadObject<T>):Monad<T> {
    return {
        unwrap() {
            if ("ok" in res) {
                return res.ok;
            } else {
                throw res.error;
            }
        },
        match(match) {
            if ("ok" in res) {
                match.ok(res.ok);
            } else {
                match.error(res.error);
            }
        },
        should: {
            ok(value) {
                if ("ok" in res) {
                    Assert.strictEqual(res.ok, value);
                } else {
                    throw new Error(`Monad has error: ${res.error}`);
                }
            },
            error(error) {
                if ("error" in res) {
                    Assert.throws(() => {
                        throw res.error
                    }, error);
                } else {
                    throw new Error(`Monad is ok with value: ${res.ok}`);
                }
            }
        }
    };
}
function isThenable<T>(obj:any):obj is PromiseLike<T> {
    return obj && typeof obj.then === "function";
}
export function monad<T>(cb:()=>PromiseLike<T>):Promise<Monad<T>>;
export function monad<T>(cb:()=>T):Monad<T>;
export function monad<T>(cb:()=>T|PromiseLike<T>):Monad<T>|Promise<Monad<T>> {
    try {
        const res = cb();
        if (isThenable<T>(res)) {
            return new Promise<Monad<T>>(async resolve => {
                try {
                    resolve(monadify({
                        ok: await res
                    }));
                } catch (e) {
                    resolve(monadify({
                        error: e
                    }));
                }
            });
        } else {
            return monadify({
                ok: res
            });
        }
    } catch (e) {
        return monadify({
            error: e
        });
    }
}