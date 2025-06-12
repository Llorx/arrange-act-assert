import * as Util from "util";
import * as Path from "path";

import { TestInfo, Messages, MessageType, Formatter, TestType } from "."
import { Summary, SummaryResult } from "../testRunner/testRunner";
import { CoverageEntry } from "../coverage/Coverage";
import mergeCoverage from "../coverage/merge";
import { getCommonBasePath } from "../utils/utils";

export const enum Style {
    None = "",
    Reset = "\x1b[0m",
    Bold = "\x1b[1m",
    Green = "\x1b[92m",
    Red = "\x1b[91m",
    Yellow = "\x1b[93m"
}

class TestFormatter {
    readonly children:TestFormatter[] = [];
    private readonly _pendingShown:TestFormatter[] = [];
    private _shown = false;
    private _pendingLogs:[test:TestFormatter, logs:Parameters<typeof this._log>][] = [];
    private _pending = new Set<TestFormatter>;
    private _next:TestFormatter|null = null;
    private _startLogged = false;
    childrenOk = true;
    ended = false;
    error:string|null = null;
    constructor(readonly out:((msg:string) => void)|null, readonly info:TestInfo, readonly level:number, readonly parent:TestFormatter|null) {}
    private _setChildError() {
        if (this.childrenOk) {
            this.childrenOk = false;
            if (this.parent) {
                this.parent._setChildError();
            }
        }
    }
    private _startChild(test:TestFormatter) {
        if (this._next === test) {
            if (this._shown) {
                test.show();
            } else {
                this._pendingShown.push(test);
            }
        } else {
            this._pending.add(test);
        }
    }
    private _endChild(test:TestFormatter) {
        if (test.error) {
            this._setChildError();
        }
        if (this._next === test) {
            this._next = this.children[this.children.indexOf(test) + 1] || null;
            test._logEnd();
            if (this._next && this._pending.delete(this._next)) {
                this._startChild(this._next);
                if (this._next.ended) {
                    this._endChild(this._next);
                }
            }
        } else {
            this._pending.add(test);
        }
    }
    private _logStart() {
        if (!this._startLogged) {
            this._startLogged = true; // Flag as mutiple childs can notify this log
            this._log(Style.Bold, "►", this.info.description);
        }
    }
    private _logEnd() {
        if (this._startLogged) {
            if (this.error) {
                if (this.childrenOk) {
                    this._log(Style.Red, "X", `${this.info.description}:\n`, this.error);
                } else {
                    this._log(Style.Yellow, "►", this.info.description);
                }
            } else {
                this._log(Style.None, "√", this.info.description);
            }
        } else if (this.error) {
            this._log(Style.Red, "X", `${this.info.description}:\n`, this.error);
        } else if (this._startLogged) {
            // TODO: Test delayed tests
            this._log(Style.None, "√", this.info.description);
        } else {
            this._log(Style.Green, "√", this.info.description);
        }
    }
    addChild(test:TestFormatter) {
        this.children.push(test);
        if (!this._next) {
            this._next = test;
        }
    }
    start() {
        if (this.parent) {
            this.parent._logStart();
            this.parent._startChild(this);
        }
    }
    end(error:string|null) {
        this.ended = true;
        this.error = error;
        if (this.parent) {
            this.parent._endChild(this);
        }
    }
    show() {
        this._shown = true;
        for (const child of this._pendingShown) {
            child.show();
        }
        for (const [test, args] of this._pendingLogs.splice(0)) {
            test._log(...args);
        }
    }
    private _log(style:Style, icon:string, ...args:any[]) {
        if (this._shown) {
            if (this.out) {
                const pad = " ".repeat((this.level * 2));
                icon = icon ? `${icon} ` : icon;
                const padIcon = " ".repeat((icon.length));
                const formatted = args.map(arg => Util.format("%s", arg)).join("");
                const lines = formatted.split("\n").map((line, i) => {
                    if (i === 0) {
                        return `${pad}${style}${icon}${line}${Style.Reset}`;
                    } else {
                        return `${pad + padIcon}${line}`;
                    }
                });
                this.out(lines.join("\n"));
            }
        } else {
            this._addLogs([style, icon, ...args]);
        }
    }
    private _addLogs(args:Parameters<typeof this._log>, test:TestFormatter = this) {
        if (this.parent && !this.parent._shown) {
            this.parent._addLogs(args, test);
        } else {
            this._pendingLogs.push([test, args]);
        }
    }
}
class Root extends TestFormatter {
    constructor(parent:TestFormatter|null) {
        super(null, {
            parentId: -1,
            description: "",
            type: TestType.DESCRIBE
        }, -1, parent);
    }
}

function getUid(fileId:string, testId:number) {
    return `${fileId}_${testId}`;
}

function formatSummaryResult(title:string, result:SummaryResult) {
    const okColor = result.error > 0 ? Style.Yellow : Style.Green;
    let msg = `- ${title}: ${result.count === 0 ? Style.Red : okColor}${result.count}${Style.Reset}`;
    if (result.error > 0) {
        msg += `\n  · OK: ${result.ok === 0 ? Style.Red : okColor}${result.ok}${Style.Reset}`;
        msg += `\n  · ERROR: ${Style.Red}${result.error}${Style.Reset}`;
    }
    return msg;
}
type PathCoverageEntry = CoverageEntry & {
    path:string[];
};
type TreeFolder = {
    path:string[];
    entries:TreeEntry;
};
type TreeEntry = {
    files:PathCoverageEntry[];
    folders:TreeFolder[];
};
function tryShrinkFolder(folder:TreeFolder) {
    if (folder.entries.files.length === 0 && folder.entries.folders.length === 1) {
        const subFolder = folder.entries.folders[0]!;
        folder.path.push(...subFolder.path);
        folder.entries = subFolder.entries;
    }
    return folder;
}
function getFolderTree(coverage:PathCoverageEntry[], parentPath:string[] = []) {
    const tree:TreeEntry = {
        files: [],
        folders: []
    };
    let pathCheck:string|null = null;
    let preSlice = 0;
    let i = 0;
    // Extract files first
    while (i < coverage.length) {
        const entry = coverage[i]!;
        const isFile = entry.path.length - 1 <= parentPath.length;
        if (isFile) {
            tree.files.push({
                ...entry,
                path: entry.path.slice(parentPath.length)
            });
        } else {
            preSlice = i;
            pathCheck = entry.path[parentPath.length]!;
            break;
        }
        i++;
    }
    // Extract folders after files
    if (pathCheck) {
        while (i <= coverage.length) {
            const entry = coverage[i];
            const isIncluded = entry && entry.path[parentPath.length] === pathCheck;
            if (!isIncluded || i === coverage.length) {
                const subList = coverage.slice(preSlice, i);
                const subTree = {
                    path: [ pathCheck ],
                    entries: getFolderTree(subList, [...parentPath, pathCheck])
                };
                tryShrinkFolder(subTree);
                tree.folders.push(subTree);
                if (entry) {
                    pathCheck = entry.path[parentPath.length]!;
                    preSlice = i;
                }
            }
            i++;
        }
    }
    return tree;
}
function groupCoverages(baseFolder:string, coverage:CoverageEntry[]) {
    const pathCoverage = coverage.map(entry => ({
        ...entry,
        path: entry.file.substring(baseFolder.length).split(Path.sep)
    })).sort((a, b) => {
        // Group folders, ordering files on top of their folders
        const maxPath = Math.min(a.path.length - 1, b.path.length - 1);
        for (let i = 0; i < maxPath; i++) {
            const res = a.path[i]!.localeCompare(b.path[i]!);
            if (res !== 0) {
                return res;
            }
        }
        if (a.path.length !== b.path.length) {
            return a.path.length - b.path.length;
        }
        return a.path[maxPath]!.localeCompare(b.path[maxPath]!);
    });
    return getFolderTree(pathCoverage);
}
const enum TableCharacters {
    Leaf = "└",
    Skip = "│",
    Connect = "├"
}
const enum TableTitles {
    Coverage= "Coverage result",
    File = "File",
    Total = "Total",
    Lines = "Lines",
    UncoveredLines = "Uncovered lines"
}
type CoverageRow = {
    padding:string;
    file:string;
    lines:{
        total:number;
        uncovered:number;
        ratio:number;
    }|null;
    uncoveredLines:string;
};
export class DefaultFormatter implements Formatter {
    private readonly _root = new Root(null);
    private readonly tests = new Map<string, TestFormatter>();
    private readonly coverage:CoverageEntry[][] = [];
    constructor(private readonly _out:(msg:string)=>void = console.log) {
        this._root.show();
    }
    private _processCoverageFile(padding:string, file:PathCoverageEntry, rows:CoverageRow[]) {
        const uncoveredLines:string[] = [];
        let uncoveredLinesCount = 0;
        let pendingUncovered:number|null = null;
        for (let i = 0; i < file.lines.length; i++) {
            const line = file.lines[i]!;
            const uncoveredBranches:string[] = [];
            let nextRange = 0;
            for (const range of line.ranges) {
                if (range.start === nextRange) {
                    nextRange = range.end;
                } else {
                    uncoveredBranches.push(nextRange + 1 !== range.start ? `${nextRange + 1}-${range.start}` : String(nextRange + 1));
                    nextRange = range.end;
                }
            }
            if (line.length !== nextRange && uncoveredBranches.length === 0) {
                uncoveredLinesCount++;
                if (pendingUncovered == null) {
                    pendingUncovered = i;
                }
            } else if (pendingUncovered != null) {
                uncoveredLines.push(`${Style.Red}${pendingUncovered !== i - 1 ? `${pendingUncovered + 1}-${i}` : pendingUncovered + 1}${Style.Reset}`);
                pendingUncovered = null;
            }
            if (uncoveredBranches.length > 0) {
                uncoveredLines.push(`${Style.Yellow}${i + 1}${Style.Reset}:[${uncoveredBranches.join("|")}]`);
            }
        }
        if (pendingUncovered != null) {
            uncoveredLines.push(`${Style.Red}${pendingUncovered !== file.lines.length - 1 ? `${pendingUncovered + 1}-${file.lines.length}` : pendingUncovered + 1}${Style.Reset}`);
        }
        rows.push({
            padding: padding,
            file: file.path.join(Path.sep),
            lines: {
                total: file.lines.length,
                uncovered: uncoveredLinesCount,
                ratio: (file.lines.length - uncoveredLinesCount) / file.lines.length
            },
            uncoveredLines: uncoveredLines.join(", ")
        });
    }
    private _processCoverageTree(prefix:string, root:boolean, tree:TreeEntry, _rows:CoverageRow[] = []) {
        for (let i = 0; i < tree.files.length; i++) {
            const file = tree.files[i]!;
            const isLast = tree.folders.length === 0 && i === tree.files.length - 1;
            const padding = `${prefix}${!root ? `${isLast ? TableCharacters.Leaf : TableCharacters.Connect} ` : ""}`;
            this._processCoverageFile(padding, file, _rows);
        }
        for (let i = 0; i < tree.folders.length; i++) {
            const folder = tree.folders[i]!;
            const isLast = i === tree.folders.length - 1;
            const padding = `${prefix}${!root ? `${isLast ? TableCharacters.Leaf : TableCharacters.Connect} ` : ""}`;
            _rows.push({
                padding: padding,
                file: folder.path.join(Path.sep),
                lines: null,
                uncoveredLines: ""
            });
            this._processCoverageTree(`${prefix}${!root ? (isLast ? " " : TableCharacters.Skip) : ""}${!root ? " " : ""}`, false, folder.entries, _rows);
        }
        return _rows;
    }
    
    private _formatCoverage() {
        const coverage = mergeCoverage(this.coverage);
        if (coverage.length > 0) {
            const baseFolder = getCommonBasePath(coverage.map(entry => entry.file));
            const coverageTree = groupCoverages(baseFolder, coverage);
            const rows = this._processCoverageTree("", true, coverageTree);
            const maxLength = {
                file: Math.max(TableTitles.File.length, TableTitles.Total.length),
                lines: TableTitles.Lines.length
            };
            for (const row of rows) {
                const fileLength = row.padding.length + row.file.length;
                if (fileLength > maxLength.file) {
                    maxLength.file = fileLength;
                }
            }
            this._out(`\n${TableTitles.Coverage}:`);
            this._out(`┏━${"━".repeat(maxLength.file)}━┳━${"━".repeat(maxLength.lines)}━┳━━━ ━━  ━━   ──    ─`);
            this._out(`┃ ${TableTitles.File.padEnd(maxLength.file, " ")} ┃ ${TableTitles.Lines.padEnd(maxLength.lines, " ")} ┃ ${TableTitles.UncoveredLines}`);
            this._out(`┣━${"━".repeat(maxLength.file)}━╋━${"━".repeat(maxLength.lines)}━╋━━━ ━━  ━━   ──    ─`);
            
            let totalLines = 0;
            let totalUncoveredLines = 0;
            for (const row of rows) {
                const color = row.lines ? row.lines.ratio >= 0.9 ? Style.Green : row.lines.ratio >= 0.5 ? Style.Yellow : Style.Red : "";
                const lines = row.lines != null ? `${Math.floor(row.lines.ratio * 100)} %` : "";
                if (row.lines != null) {
                    totalLines += row.lines.total;
                    totalUncoveredLines += row.lines.uncovered;
                }
                this._out(`┃ ${row.padding}${color}${row.file.padEnd(maxLength.file - row.padding.length, " ")}${Style.Reset} ┃ ${color}${lines.padStart(maxLength.lines, " ")}${Style.Reset} ┃ ${row.uncoveredLines}`);
            }
            this._out(`┣━${"━".repeat(maxLength.file)}━╋━${"━".repeat(maxLength.lines)}━╋━━━ ━━  ━━   ──    ─`);

            const lines = `${Math.floor(((totalLines - totalUncoveredLines) / totalLines) * 100)} %`;
            this._out(`┃ ${TableTitles.Total.padStart(maxLength.file, " ")} ┃ ${lines.padStart(maxLength.lines, " ")} ┃`);
            this._out(`┗━${"━".repeat(maxLength.file)}━┻━${"━".repeat(maxLength.lines)}━┛`);
        }
    }
    formatSummary(summary:Summary) {
        this._out(`\n${Style.Bold}Summary:${Style.Reset}`);
        this._out(formatSummaryResult("Asserts", summary.assert));
        this._out(formatSummaryResult("Tests", summary.test));
        if (summary.describe.count > 0) {
            this._out(formatSummaryResult("Describes", summary.describe));
        }
        this._out(formatSummaryResult("Total", summary.total));
        this._formatCoverage();
        for (const {fileId, id, error} of summary.failed) {
            const test = this.tests.get(getUid(fileId, id));
            if (test && test.childrenOk) {
                const lines:string[] = [];
                let parent:TestFormatter|null = test;
                while (parent && !(parent instanceof Root)) {
                    const pad = " ".repeat((parent.level * 2));
                    if (parent === test) {
                        lines.unshift(`${pad}${Style.Red}X ${parent.info.description}:${Style.Reset}`);
                    } else {
                        lines.unshift(`${pad}${Style.Bold}► ${parent.info.description}${Style.Reset}`);
                    }
                    parent = parent.parent;
                }
                this._out(`${Style.Yellow}[X]----- - - - -  -  -   -${Style.Reset}`);
                this._out(lines.join("\n"));
                this._out(error);
            }
        }
        if (summary.test.count === 0) {
            // TODO: Test no tests run
            throw new Error("No test run");
        }
        if (summary.assert.count === 0) {
            // TODO: Test no asserts run
            throw new Error("No asserts run");
        }
        return summary;
    }
    format(fileId:string, msg:Messages):void {
        switch (msg.type) {
            case MessageType.COVERAGE: {
                this.coverage.push(msg.coverage);
                break;
            }
            case MessageType.FILE_START: {
                const root = new Root(this._root);
                this._root.addChild(root);
                root.start();
                this.tests.set(fileId, root);
                break;
            }
            case MessageType.FILE_END: {
                const test = this.tests.get(fileId);
                if (!test) {
                    throw new Error("Received file end without file start");
                }
                test.end(null);
                break;
            }
            case MessageType.ADDED: {
                if (msg.test.description) {
                    const testId = getUid(fileId, msg.id);
                    let parent = this.tests.get(getUid(fileId, msg.test.parentId));
                    if (!parent) {
                        parent = this.tests.get(fileId);
                        if (!parent) {
                            parent = this._root;
                        }
                    }
                    const test = new TestFormatter(this._out, msg.test, parent.level + 1, parent);
                    parent.addChild(test);
                    this.tests.set(testId, test);
                }
                break;
            }
            case MessageType.START: {
                const testId = getUid(fileId, msg.id);
                const test = this.tests.get(testId);
                if (test) {
                    test.start();
                }
                break;
            }
            case MessageType.END: {
                const testId = getUid(fileId, msg.id);
                const test = this.tests.get(testId);
                if (test) {
                    test.end(msg.error || null);
                }
                break;
            }
        }
    }
}