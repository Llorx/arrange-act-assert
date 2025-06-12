import { spawn } from "child_process";
import { TestOptions } from "../testRunner/testRunner";

// Load EntryPoint and avoid running AAA_TEST_FILE
const AAA_TEST_FILE = process.env.AAA_TEST_FILE;
process.env.AAA_TEST_FILE = "";
import * as EntryPoint from "./entryPoint";
process.env.AAA_TEST_FILE = AAA_TEST_FILE;

export type SpawnTestFileOptions = {
    prefix:string[];
} & TestOptions;

export function spawnTestFile(path:string, options:SpawnTestFileOptions, cb:(msg:unknown)=>void) {
    return new Promise<void>((resolve, reject) => {
        const execArgv = process.execArgv.slice();
        const env = {...process.env};
        if (!options.disableSourceMaps) {
            if (!execArgv.includes("--enable-source-maps")) {
                execArgv.push("--enable-source-maps");
            }
            if (env.NODE_OPTIONS) {
                if (!env.NODE_OPTIONS.includes("--enable-source-maps")) {
                    env.NODE_OPTIONS = `${env.NODE_OPTIONS} --enable-source-maps`;
                }
            } else {
                env.NODE_OPTIONS = "--enable-source-maps";
            }
        }
        const testProcess = spawn(process.execPath, [...execArgv, ...options.prefix, EntryPoint.path], {
            env: {
                ...env,
                AAA_TEST_FILE: path,
                AAA_TEST_OPTIONS: JSON.stringify({
                    snapshotsFolder: options.snapshotsFolder,
                    confirmSnapshots: options.confirmSnapshots,
                    reviewSnapshots: options.reviewSnapshots,
                    regenerateSnapshots: options.regenerateSnapshots,
                    coverage: options.coverage,
                    disableSourceMaps: options.disableSourceMaps
                })
            },
            stdio: ["ignore", "pipe", "pipe", "ipc"],
            serialization: "advanced"
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