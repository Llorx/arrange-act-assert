import * as Url from "url";
import * as Path from "path";
import * as Module from "module";
import * as Fs from "fs";
import type * as Inspector from "inspector";

import { Line, LineRange } from "./Line";
import { testRegex } from "../utils/utils";
import getSourceMap from "./sourceMaps/getSourceMap";

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
    const entry = sourceMap.findEntry(line, column) as Module.SourceMapping;
    if (entry.originalLine != null && entry.generatedLine != null) {
        entry.originalLine += line - entry.generatedLine;
    }
    if (entry.originalColumn != null && entry.generatedColumn != null) {
        entry.originalColumn += column - entry.generatedColumn;
    }
    return entry;
}
const ignoreRegex = /\/\* coverage ignore next (?<lines>\d+ )?\*\//;
const enableRegex = /\/\* coverage (?<state>enable|disable) \*\//;

export type CoverageLine = {
    length:number;
    ranges:LineRange[];
};
export type CoverageEntry = {
    file:string;
    error:string|null;
    lines:CoverageLine[];
};
const fileCache = new Map<string, {
    code:string;
    sourceMap:Module.SourceMapPayload|null;
}>();
class FileManager {
    private _files = new Map<string, {
        deleted:boolean;
        error:string|null;
        sourceMap:Module.SourceMapPayload|null;
        lines:Line[];
    }>();
    async getState(file:string, sourceMap:boolean) {
        let data = this._files.get(file);
        if (data) {
            if (data.deleted) {
                return null;
            }
            return data;
        }
        const cache = fileCache.get(file);
        const code = cache ? cache.code : await Fs.promises.readFile(file, "utf8");
        this._files.set(file, data = {
            deleted: false,
            error: null,
            sourceMap: sourceMap ? ((cache && cache.sourceMap) || await getSourceMap(Path.dirname(file), code)) : null,
            lines: []
        });
        if (!cache) {
            fileCache.set(file, {
                code: code,
                sourceMap: data.sourceMap
            });
        } else if (!cache.sourceMap && data.sourceMap) {
            cache.sourceMap = data.sourceMap;
        }
        let pos = 0;
        let ignoreLines = 0;
        const lines = code.split(/(?<=\r?\n)/); // Positive lookbehind to keep the \r\n in the string
        for (const line of lines) {
            let lineEnd = pos + line.length;
            if (line[line.length - 1] === "\n") {
                lineEnd--; // Remove the \n
            }
            if (line[line.length - 2] === "\r") {
                lineEnd--; // Remove the \r
            }
            data.lines.push(new Line(pos, lineEnd, ignoreLines > 0 ? !!ignoreLines-- : false));
            pos += line.length;
            const ignoreMatch = ignoreRegex.exec(line);
            if (ignoreMatch) {
                const lines = ignoreMatch.groups && ignoreMatch.groups.lines;
                ignoreLines = lines != null ? Number(lines) : 1;
            }
            const enableMatch = enableRegex.exec(line);
            if (enableMatch) {
                ignoreLines = (enableMatch.groups && enableMatch.groups.state === "disable") ? Infinity : 0;
            }
        }
        return data;
    }
    deleteState(file:string) {
        const data = this._files.get(file);
        if (data) {
            data.deleted = true;
        } else {
            this._files.set(file, {
                deleted: true,
                error: null,
                sourceMap: null,
                lines: []
            });
        }
    }
    summary(branches:boolean) {
        const result:CoverageEntry[] = [];
        for (const [file, { deleted, lines, error }] of this._files) {
            if (!deleted) {
                result.push({
                    file: file,
                    error: error,
                    lines: lines.map(line => ({
                        length: line.length,
                        ranges: line.getRanges(branches)
                    }))
                });
            }
        }
        return result;
    }
}
export type CoverageOptions = {
    excludeFiles:string[];
    exclude:RegExp[];
    branches:boolean;
    sourceMaps:boolean;
};
export async function processCoverage(coverage:Inspector.Profiler.ScriptCoverage[], options:CoverageOptions):Promise<CoverageEntry[]> {
    const fileManager = new FileManager();
    for (const entry of coverage) {
        try {
            if (entry.url.startsWith("file:")) {
                const file = Url.fileURLToPath(entry.url);
                if (!options.excludeFiles.includes(file) && !testRegex(file, options.exclude)) {
                    const fileState = await fileManager.getState(file, true);
                    if (fileState) {
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
                                    if (fileState.sourceMap && !fileState.error) {
                                        let sourceFile = null;
                                        try {
                                            const sourceMap = new Module.SourceMap(fileState.sourceMap);
                                            const sourceStart = findOrigin(sourceMap, start.line, start.column);
                                            const sourceEnd = findOrigin(sourceMap, end.line, end.column);
                                            if (!sourceStart.originalSource && sourceEnd.originalSource && start.line === 0) {
                                                // First line doesn't appear in the mapfile, so get the first line in the map source
                                                const sourceFile = fileState.sourceMap.sources[0];
                                                if (sourceFile) {
                                                    sourceStart.originalSource = sourceFile;
                                                    sourceStart.originalLine = 0;
                                                    sourceStart.originalColumn = 0;
                                                }
                                            }
                                            if (sourceStart.originalSource && sourceStart.originalSource === sourceEnd.originalSource) {
                                                sourceFile = sourceStart.originalSource;
                                                if (!options.excludeFiles.includes(sourceFile) && !testRegex(sourceFile, options.exclude)) {
                                                    if (options.sourceMaps) {
                                                        const sourceFileState = await fileManager.getState(sourceFile, false);
                                                        if (sourceFileState) {
                                                            const maxLine = Math.min(sourceEnd.originalLine, sourceFileState.lines.length - 1);
                                                            for (let i = sourceStart.originalLine; i <= maxLine; i++) {
                                                                sourceFileState.lines[i]!.count(i === sourceStart.originalLine ? sourceStart.originalColumn : 0, i === sourceEnd.originalLine ? sourceEnd.originalColumn : null, range.count);
                                                            }
                                                        }
                                                        fileManager.deleteState(file);
                                                    } else {
                                                        fileManager.deleteState(sourceFile);
                                                    }
                                                } else {
                                                    fileManager.deleteState(file);
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
                    }
                }
            }
        } catch (e) {}
    }
    return fileManager.summary(options.branches);
}