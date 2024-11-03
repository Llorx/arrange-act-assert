import { spawn } from "child_process";

export type SpawnTestFileOptions = {
    prefix:string[];
};

export function spawnTestFile(path:string, options:SpawnTestFileOptions, cb:(msg:unknown)=>void) {
    return new Promise<void>((resolve, reject) => {
        const testProcess = spawn(process.execPath, [...options.prefix, path], {
            env: {...process.env, AAA_TEST_FILE: "1"},
            stdio: ["ignore", "pipe", "pipe", "ipc"]
        });
        const out:Uint8Array[] = [];
        const err:Uint8Array[] = [];
        testProcess.stdout!.on("data", data => {
            out.push(data);
        });
        testProcess.stderr!.on("data", data => {
            err.push(data);
        });
        testProcess.on("message", cb);
        testProcess.on("error", reject);
        testProcess.on("close", () => {
            if (testProcess.exitCode != 0) {
                reject(new Error(`Test file ended with exit code: ${testProcess.exitCode}.\n- Output:\n${Buffer.concat(out).toString()}\n- Error:\n${Buffer.concat(err).toString()}`));
            } else {
                resolve();
            }
        });
    });
}