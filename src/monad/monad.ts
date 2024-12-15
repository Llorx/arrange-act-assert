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
export function monad<T>(cb:()=>T):Monad<T> {
    try {
        return monadify({
            ok: cb()
        });
    } catch (e) {
        return monadify({
            error: e
        });
    }
}
export async function asyncMonad<T>(cb:()=>PromiseLike<T>):Promise<Monad<T>> {
    try {
        return monadify({
            ok: await cb()
        });
    } catch (e) {
        return monadify({
            error: e
        });
    }
}