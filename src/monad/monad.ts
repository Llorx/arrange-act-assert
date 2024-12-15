import * as Assert from "assert";

type MonadObject<T> = {
    ok:T;
} | {
    error:unknown;
};
export type Monad<T> = MonadObject<T> & {
    should: {
        ok(value:T):void;
        error(error:Assert.AssertPredicate):void;
    }
};
function monadify<T>(res:MonadObject<T>):Monad<T> {
    return {
        ...res,
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