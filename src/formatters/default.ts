import * as Util from "util";

import { TestInfo, Messages, MessageType, Formatter, TestType } from "."
import { Summary, SummaryResult } from "../testRunner/testRunner";

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

export class DefaultFormatter implements Formatter {
    private readonly _root = new Root(null);
    private readonly tests = new Map<string, TestFormatter>();
    constructor(private readonly _out:(msg:string)=>void = console.log) {
        this._root.show();
    }
    formatSummary(summary:Summary) {
        this._out(`\n${Style.Bold}Summary:${Style.Reset}`);
        this._out(formatSummaryResult("Asserts", summary.assert));
        this._out(formatSummaryResult("Tests", summary.test));
        if (summary.describe.count > 0) {
            this._out(formatSummaryResult("Describes", summary.describe));
        }
        this._out(formatSummaryResult("Total", summary.total));
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
        return summary;
    }
    format(fileId:string, msg:Messages):void {
        switch (msg.type) {
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