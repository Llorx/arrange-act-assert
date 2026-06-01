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

export async function functionRunner<ARGS extends any[], RES>(type:string, cb:((...args:ARGS)=>RES)|null, args:[...ARGS], timeout?:number):Promise<RunMonad<Awaited<RES>>> {
    if (!cb) {
        return {
            run: false,
            data: undefined as Awaited<RES>
        };
    }
    try {
        // The callback's synchronous part runs here (a sync throw is caught
        // below); its result (promise or value) is then raced against the
        // per-callback timeout.
        const res = await withTimeout(cb(...args), type, timeout);
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

function withTimeout<T>(value:T, type:string, timeout:number|undefined):Promise<Awaited<T>> {
    const promise = Promise.resolve(value) as Promise<Awaited<T>>;
    if (!(timeout != null && timeout > 0)) {
        return promise;
    }
    return new Promise<Awaited<T>>((resolve, reject) => {
        // While the event loop is alive (other tests running, IPC channel open,
        // pending IO...), this timer fires and fails just this callback
        // (ARRANGE/ACT/ASSERT/SNAPSHOT/AFTER...) with a timeout error. The timer
        // is `unref`'d so it never keeps the process alive on its own: if the
        // hanging callback is the only thing left, the process drains and the
        // `process.on("exit")` safety net reports the test as unfinished
        // instead.
        const timer = setTimeout(() => {
            reject(new Error(`${type} timed out after ${timeout}ms`));
        }, timeout);
        timer.unref();
        promise.then(value => {
            clearTimeout(timer);
            resolve(value);
        }, error => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
