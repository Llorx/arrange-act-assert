import * as Url from "url";
import * as Module from "module";
import * as Fs from "fs";
import * as Inspector from "inspector";

import { Line, LineRange } from "./Line";

function getLineColumn(lines:{start:number, end:number}[], position:number) {
    let start = 0;
    let end = lines.length - 1;
    while (start <= end) {
        const mid = Math.floor((start + end) / 2);
        if (position >= lines[mid]!.start && position <= lines[mid]!.end) {
            return {
                line: mid,
                column: position - lines[mid]!.start
            };
        }
        if (position < lines[mid]!.start) {
            end = mid - 1;
        } else {
            start = mid + 1;
        }
    }
    return null;
}
function findOrigin(sourceMap:Module.SourceMap, line:number, column:number) {
    const entry = sourceMap.findEntry(line, column);
    if (entry.originalLine != null && entry.generatedLine != null) {
        entry.originalLine += line - entry.generatedLine;
    }
    if (entry.originalColumn != null && entry.generatedColumn != null) {
        entry.originalColumn += column - entry.generatedColumn;
    }
    return entry;
}
export type CoverageLine = {
    length:number;
    ranges:LineRange[];
};
export type CoverageEntry = {
    file:string;
    error:string|null;
    lines:CoverageLine[];
};
class FileManager {
    private _files = new Map<string, {
        error:string|null;
        lines:Line[];
    }>();
    async getState(file:string) {
        let data = this._files.get(file);
        if (data) {
            return data;
        }
        const code = await Fs.promises.readFile(file, "utf8");
        this._files.set(file, data = {
            error: null,
            lines: []
        });
        let i = 0;
        let prevLine = 0;
        while (i < code.length) {
            if (code[i] === "\n") {
                let lineEnd = i;
                if (code[i - 1] === "\r") {
                    lineEnd--;
                }
                data.lines.push(new Line(prevLine, lineEnd));
                prevLine = ++i;
            } else {
                i++;
            }
        }
        if (prevLine < code.length) {
            data.lines.push(new Line(prevLine, code.length));
        }
        return data;
    }
    deleteState(file:string) {
        return this._files.delete(file);
    }
    summary() {
        const result:CoverageEntry[] = [];
        for (const [file, { lines, error }] of this._files) {
            result.push({
                file: file,
                error: error,
                lines: lines.map(line => ({
                    length: line.length,
                    ranges: line.getRanges()
                }))
            });
        }
        return result;
    }
}
export class Coverage {
    private _session:Inspector.Session|null = null;
    private async _processCoverage(coverage:Inspector.Profiler.TakePreciseCoverageReturnType):Promise<CoverageEntry[]> {
        const fileManager = new FileManager();
        for (const entry of coverage.result) {
            try {
                if (entry.url.startsWith("file:")) {
                    const file = Url.fileURLToPath(entry.url);
                    const sourceMap = Module.findSourceMap(entry.url);
                    const fileState = await fileManager.getState(file);
                    for (const func of entry.functions) {
                        for (const range of func.ranges) {
                            try {
                                const start = getLineColumn(fileState.lines, range.startOffset);
                                const end = getLineColumn(fileState.lines, range.endOffset);
                                if (!start || !end) {
                                    throw new Error("Error searching for line and column");
                                }
                                const maxLine = Math.min(end.line, fileState.lines.length - 1);
                                for (let i = start.line; i <= maxLine; i++) {
                                    fileState.lines[i]!.count(i === start.line ? start.column : 0, i === end.line ? end.column : null, range.count);
                                }
                                if (sourceMap && !fileState.error) {
                                    let sourceFile = null;
                                    try {
                                        const sourceStart = findOrigin(sourceMap, start.line, start.column);
                                        const sourceEnd = findOrigin(sourceMap, end.line, end.column);
                                        if (!sourceStart.originalSource && sourceEnd.originalSource && start.line === 0) {
                                            // First line doesn't appear in the mapfile, so get the first line in the map source
                                            const sourceFile = sourceMap.payload.sources[0];
                                            if (sourceFile) {
                                                sourceStart.originalSource = sourceFile;
                                                sourceStart.originalLine = 0;
                                                sourceStart.originalColumn = 0;
                                            }
                                        }
                                        if (sourceStart.originalSource && sourceStart.originalSource === sourceEnd.originalSource) {
                                            sourceFile = Url.fileURLToPath(sourceStart.originalSource);
                                            const sourceFileState = await fileManager.getState(sourceFile);
                                            const maxLine = Math.min(sourceEnd.originalLine, sourceFileState.lines.length - 1);
                                            for (let i = sourceStart.originalLine; i <= maxLine; i++) {
                                                sourceFileState.lines[i]!.count(i === sourceStart.originalLine ? sourceStart.originalColumn : 0, i === sourceEnd.originalLine ? sourceEnd.originalColumn : null, range.count);
                                            }
                                        }
                                    } catch (e) {
                                        fileState.error = String(e);
                                        if (sourceFile) {
                                            // Keep original only with the error
                                            fileManager.deleteState(sourceFile);
                                        }
                                    }
                                }
                            } catch (e) {
                                fileState.error = String(e);
                            }
                        }
                    }
                    if (sourceMap && fileState.error == null) {
                        // Keep sourcemap only
                        fileManager.deleteState(file);
                    }
                }
            } catch (e) {}
        }
        return fileManager.summary();
    }
    start() {
        return new Promise<void>((resolve, reject) => {
            if (this._session) {
                return resolve();
            }
            this._session = new Inspector.Session();
            this._session.connect();
            this._session.post("Profiler.enable", (err) => {
                if (err) {
                    this._session && this._session.disconnect();
                    this._session = null;
                    reject(err);
                } else {
                    if (!this._session) {
                        return resolve();
                    }
                    this._session.post("Profiler.startPreciseCoverage", {
                        callCount: true,
                        detailed: true
                    }, err => {
                        if (err) {
                            if (!this._session) {
                                return reject(err);
                            }
                            this._session.post("Profiler.disable", () => {
                                this._session && this._session.disconnect();
                                this._session = null;
                                reject(err);
                            });
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }
    takeCoverage() {
        return new Promise<CoverageEntry[]>((resolve, reject) => {
            if (!this._session) {
                return reject("No session enabled");
            }
            this._session.post("Profiler.takePreciseCoverage", async (err, coverage) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        resolve(await this._processCoverage(coverage));
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    stop() {
        return new Promise<void>(resolve => {
            if (!this._session) {
                return resolve();
            }
            this._session.post("Profiler.stopPreciseCoverage", () => {
                if (!this._session) {
                    return resolve();
                }
                this._session.post("Profiler.disable", () => {
                    this._session && this._session.disconnect();
                    this._session = null;
                    resolve();
                });
            });
        });
    }
}