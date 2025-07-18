import * as OS from "os";

import { SpawnTestFileOptions } from "../spawnTestFile/spawnTestFile";
import { parallelize } from "../parallelize/parallelize";
import { MainContext } from "./MainContext";
import { newRoot, RunTestFileOptions, Summary, TestOptions } from "../testRunner/testRunner";
import { Formatter, MessageType } from "../formatters";
import { DefaultFormatter } from "../formatters/default";
import { ReadDirOptions } from "../readDir/readDir";
import coverage from "../coverage/singleton";
import * as Utils from "../utils/utils";

export type TestSuiteOptions = {
    parallel:number;
    folder:string;
    formatter:Formatter;
} & ReadDirOptions & SpawnTestFileOptions & RunTestFileOptions & TestOptions;

export type TestResult = {
    files:string[];
    runErrors:unknown[];
    ok:boolean;
    summary:Summary;
};

const DEFAULT_OPTIONS:TestSuiteOptions = {
    parallel: OS.cpus().length,
    folder: process.cwd(),
    include: [/(\\|\/|.*(\.|-|_))(test)(\.|(\.|-|\\|\/).*.)(cjs|mjs|js)$/i],
    exclude: [/\/node_modules\//i],
    prefix: [],
    clearModuleCache: false,
    formatter: new DefaultFormatter()
};
export type TestSuiteContext = {
    getFiles(path:string, options:ReadDirOptions):Promise<string[]>;
};
export class TestSuite {
    options;
    private _root;
    constructor(options:Partial<TestSuiteOptions>, readonly context:TestSuiteContext = new MainContext()) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...Utils.getTestSuiteOptions(),
            ...options
        };
        this._root = newRoot(this.options);
        if (!Number.isFinite(this.options.parallel) || this.options.parallel < 0) { // TODO: test Number.isFinite
            throw new Error("Invalid parallel option. Must be >= 0");
        }
        this._root.setFormatter(this.options.formatter);
    }
    async run():Promise<TestResult> {
        if (this.options.coverage) {
            await coverage.start();
        }
        const result = await this._run();
        await this._root.end();
        if (this.options.coverage) {
            if (this.options.parallel === 0) {
                this._root.processMessage("", {
                    type: MessageType.COVERAGE,
                    coverage: await coverage.takeCoverage()
                });
            }
            await coverage.stop();
        }
        for (const error of result.errors) {
            console.error(error);
        }
        this.options.formatter.formatSummary && await this.options.formatter.formatSummary(this._root.summary, {
            excludeFiles: result.files,
            exclude: this.options.exclude,
            branches: !this.options.coverageNoBranches,
            sourceMaps: !this.options.coverageNoSourceMaps
        });
        return {
            files: result.files,
            runErrors: result.errors,
            ok: result.errors.length === 0 && this._root.summary.total.error === 0,
            summary: this._root.summary
        };
    }
    async _run() {
        const files = await this.context.getFiles(this.options.folder, this.options);
        if (this.options.parallel === 0) {
            const errors:unknown[] = [];
            for (const file of files) {
                try {
                    this._root.runTestFile(file, this.options);
                } catch (e) {
                    errors.push(e);
                }
            }
            return {
                files: files,
                errors: errors
            };
        } else {
            const results = await parallelize(this.options.parallel, this._spawnTestFiles(files));
            return {
                files: files,
                errors: results.filter(result => result.status === "rejected").map(result => result.reason)
            };
        }
    }
    private *_spawnTestFiles(testFiles:string[]) {
        for (const testFile of testFiles) {
            yield this._root.spawnTestFile(testFile, this.options);
        }
    }
}