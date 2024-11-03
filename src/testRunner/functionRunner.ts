export type RunMonad<T = unknown> = {
    run:false;
    data:T;
} | {
    run:true;
    ok:true;
    data:T;
} | {
    run:true;
    ok:false;
    error:unknown;
    type:string;
};

export async function functionRunner<ARGS extends any[], RES>(type:string, cb:((...args:ARGS)=>RES)|undefined, args:ARGS):Promise<RunMonad<Awaited<RES>>> {
    if (!cb) {
        return {
            run: false,
            data: undefined as Awaited<RES>
        };
    }
    try {
        const res = await cb(...args);
        return {
            run: true,
            ok: true,
            data: res
        };
    } catch (e) {
        return {
            run: true,
            ok: false,
            error: e,
            type: type
        };
    }
}