import * as UTIL from "util";

import { TestInfo, Messages, MessageType, Formatter, TestType } from "."
import { Summary, SummaryResult } from "../testRunner/testRunner";

export const enum STYLE {
    NONE = "",
    RESET = "\x1b[0m",
    BOLD = "\x1b[1m",
    GREEN = "\x1b[92m",
    RED = "\x1b[91m",
    YELLOW = "\x1b[93m"
}

class Test {
    readonly children:Test[] = [];
    private readonly _pendingShown:Test[] = [];
    private _shown = false;
    private _pendingLogs:[test:Test, logs:Parameters<typeof this._log>][] = [];
    private _pending = new Set<Test>;
    private _next:Test|null = null;
    private _startLogged = false;
    childrenOk = true;
    ended = false;
    error:string|null = null;
    constructor(readonly out:((msg:string) => void)|null, readonly info:TestInfo, readonly level:number, readonly parent:Test|null) {}
    private _setChildError() {
        if (this.childrenOk) {
            this.childrenOk = false;
            if (this.parent) {
                this.parent._setChildError();
            }
        }
    }
    private _startChild(test:Test) {
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
    private _endChild(test:Test) {
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
            this._log(STYLE.BOLD, "►", this.info.description);
        }
    }
    private _logEnd() {
        if (this._startLogged) {
            if (this.error) {
                if (this.childrenOk) {
                    this._log(STYLE.RED, "X", `${this.info.description}:\n`, this.error);
                } else {
                    this._log(STYLE.YELLOW, "►", this.info.description);
                }
            } else {
                this._log(STYLE.NONE, "√", this.info.description);
            }
        } else if (this.error) {
            this._log(STYLE.RED, "X", `${this.info.description}:\n`, this.error);
        } else if (this._startLogged) {
            // TODO: Test delayed tests
            this._log(STYLE.NONE, "√", this.info.description);
        } else {
            this._log(STYLE.GREEN, "√", this.info.description);
        }
    }
    addChild(test:Test) {
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
    private _log(style:STYLE, icon:string, ...args:any[]) {
        if (this._shown) {
            if (this.out) {
                const pad = " ".repeat((this.level * 2));
                icon = icon ? `${icon} ` : icon;
                const padIcon = " ".repeat((icon.length));
                const formatted = args.map(arg => UTIL.format("%s", arg)).join("");
                const lines = formatted.split("\n").map((line, i) => {
                    if (i === 0) {
                        return `${pad}${style}${icon}${line}${STYLE.RESET}`;
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
    private _addLogs(args:Parameters<typeof this._log>, test:Test = this) {
        if (this.parent && !this.parent._shown) {
            this.parent._addLogs(args, test);
        } else {
            this._pendingLogs.push([test, args]);
        }
    }
}
class Root extends Test {
    constructor(parent:Test|null) {
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
    const okColor = result.error > 0 ? STYLE.YELLOW : STYLE.GREEN;
    let msg = `- ${title}: ${result.count === 0 ? STYLE.RED : okColor}${result.count}${STYLE.RESET}`;
    if (result.error > 0) {
        msg += `\n  · OK: ${result.ok === 0 ? STYLE.RED : okColor}${result.ok}${STYLE.RESET}`;
        msg += `\n  · ERROR: ${STYLE.RED}${result.error}${STYLE.RESET}`;
    }
    return msg;
}

export class DefaultFormatter implements Formatter {
    private readonly _root = new Root(null);
    private readonly tests = new Map<string, Test>();
    constructor(private readonly _out:(msg:string)=>void = console.log) {
        this._root.show();
    }
    formatSummary(summary:Summary) {
        this._out(`\n${STYLE.BOLD}Summary:${STYLE.RESET}`);
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
                let parent:Test|null = test;
                while (parent && !(parent instanceof Root)) {
                    const pad = " ".repeat((parent.level * 2));
                    if (parent === test) {
                        lines.unshift(`${pad}${STYLE.RED}X ${parent.info.description}:${STYLE.RESET}`);
                    } else {
                        lines.unshift(`${pad}${STYLE.BOLD}► ${parent.info.description}${STYLE.RESET}`);
                    }
                    parent = parent.parent;
                }
                this._out(`${STYLE.YELLOW}[X]----- - - - -  -  -   -${STYLE.RESET}`);
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
                    const test = new Test(this._out, msg.test, parent.level + 1, parent);
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