import { test } from "node:test";
import * as Assert from "node:assert";
import { setTimeout } from "node:timers/promises";

import { isMessage, newRoot } from "./testRunner";
import { MessageType, MessageFileStart, MessageFileEnd, MessageAdded, MessageStart, MessageEnd, Messages, TestType } from "../formatters";

import { mockFiles } from "../test_folder_mock";

type CheckMessages = MessageFileStart | MessageFileEnd | ({ id:string } & ((Omit<MessageAdded, "id"|"test"> & { test: { parentId:string } & Omit<MessageAdded["test"], "parentId"> }) | Omit<MessageStart, "id"> | Omit<MessageEnd, "id">));

test.describe("testRunner", async () => {
    // Arrange
    function assert(desc:string, a:unknown, b:unknown) {
        if (a !== b) {
            console.log("expected:", a);
            console.log("found:", b);
            throw new Error(`${desc}: Expected ${a} but found ${b}`);
        }
    }
    function stepped(start = 0) {
        let step = start;
        return {
            clone() {
                return stepped(step);
            },
            up(value:number) {
                if (step !== value) {
                    throw new Error(`Step should be ${value} before increasing. Found ${step}`);
                }
                step++;
            },
            assert(value:number) {
                if (step !== value) {
                    throw new Error(`Step should be ${value}. Found ${step}`);
                }
            }
        }
    }
    function getFormatter() {
        const messages:(Messages)[] = [];
        let firstId = -1;
        const cb = (msg:Messages) => {
            if ("id" in msg && firstId < 0) {
                firstId = msg.id;
            }
            messages.push(msg);
        };
        return {
            cb: cb,
            messages: messages,
            assert(type:string, check:(CheckMessages)[]) {
                for (const msg of check) {
                    if ("id" in msg) {
                        msg.id = eval(`${msg.id.startsWith("+") ? firstId : ""}${msg.id}`);
                        if (msg.type === MessageType.ADDED) {
                            msg.test.parentId = eval(`${msg.test.parentId.startsWith("+") ? firstId : ""}${msg.test.parentId}`);
                        }
                    }
                }
                if (JSON.stringify(messages) !== JSON.stringify(check)) {
                    console.log("Expected:", check);
                    console.log("Found:", messages);
                    throw new Error(`${type} logs are different`);
                }
                messages.splice(0);
            }
        };
    }
    await test.describe("Should run in order", async () => {
        test("with X_AFTER", async () => {
            const step = stepped();
            const myTest = newRoot();
            await myTest.test("Should run in order with AFTER_X", {
                ARRANGE(after) {
                    step.up(0);
                    after(null, () => step.up(5));
                },
                ACT(_arrange, after) {
                    step.up(1);
                    after(null, () => step.up(4));
                },
                ASSERT(_arrange, _act, after) {
                    step.up(2);
                    after(null, () => step.up(3));
                }
            });
        });
        test("within describes", async () => {
            const step = stepped();
            const myTest = newRoot();
            const descDelayed = myTest.describe("describe delayed", async (test) => {
                await setTimeout(10);
                await test.test("test delayed", {
                    ARRANGE(after) {
                        step.up(0);
                        after(null, () => step.up(3))
                    },
                    ACT() {
                        step.up(1);
                    },
                    ASSERT() {
                        step.up(2);
                    }
                });
            });
            const descDelayed2 = myTest.describe("describe delayed 2", (test) => {
                test.test("test delayed", {
                    ARRANGE(after) {
                        step.up(4);
                        after(null, () => step.up(7))
                    },
                    async ACT() {
                        step.up(5);
                        await setTimeout(10)
                    },
                    ASSERT() {
                        step.up(6);
                    }
                });
            });
            const desc = myTest.describe("describe", (test) => {
                test.test("test delayed", {
                    ARRANGE(after) {
                        step.up(8);
                        after(null, () => step.up(11))
                    },
                    ACT() {
                        step.up(9);
                    },
                    ASSERT() {
                        step.up(10);
                    }
                });
            });
            await Promise.all([desc, descDelayed2, descDelayed]);
        });
        test("now allow tests after finishing", async () => {
            // Act
            let errored = false;
            const myTest = newRoot();
            await myTest.describe("describe", test => {
                test("empty", {
                    ASSERT() {}
                });
                setTimeout(10).then(() => {
                    test.test("test", {
                        ARRANGE() {
                            return 0;
                        },
                        ACT() {
                            return 0;
                        },
                        ASSERT() {
                            return "ok";
                        }
                    }).catch(() => {
                        errored = true;
                    });
                });
            });
            await setTimeout(50);

            // Assert
            if (!errored) {
                throw new Error("Should error if adding test after finishing");
            }
        });
    });
    test.describe("Should infer data", () => {
        test("from arrange to act, assert and after", async () => {
            const myTest = newRoot();
            await myTest.test("test", {
                ARRANGE(after) {
                    return after({ pepe: 123 }, arrange => {
                        assert("AFTER ARRANGE", arrange.pepe, 123);
                    });
                },
                ACT(arrange, after) {
                    assert("ACT", arrange.pepe, 123);
                    return after(arrange.pepe + 1, (act) => {
                        assert("AFTER ACT", act, 124);
                    });
                },
                ASSERT(act, arrange, after) {
                    assert("AssertARRANGE", arrange.pepe, 123);
                    assert("AssertACT", act, 124);
                    return after(act + arrange.pepe, (ass) => {
                        assert("AFTER ASSERT", ass, 123 + 124);
                    });
                }
            });
        });
    });
    test.describe("Error managing", () => {
        test("should throw error if describe fails", async () => {
            const myTest = newRoot();
            try {
                await myTest.describe("describe", () => {
                    throw "ok";
                });
                throw new Error("Should throw error");
            } catch (e) {
                if (e !== "ok") {
                    throw e;
                }
            }
        });
        test("should not call act/assert 'after' if arrange fails", async () => {
            let validAfterCalled = 0;
            let invalidAfterCalled = 0;
            const myTest = newRoot();
            try {
                await myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => validAfterCalled++);
                        throw "ok";
                    },
                    ACT(_arr, after) {
                        after(null, () => invalidAfterCalled++);
                        return 0;
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => invalidAfterCalled++);
                        return 0;
                    }
                });
                throw new Error("Should throw error");
            } catch (e) {
                if (e !== "ok") {
                    throw e;
                }
            }
            Assert.strictEqual(validAfterCalled, 1, "Valid after should be called");
            Assert.strictEqual(invalidAfterCalled, 0, "Invalid afters should not be called");
        });
        test("should not call assert 'after' if act fails", async () => {
            let validAfterCalled = 0;
            let invalidAfterCalled = 0;
            const myTest = newRoot();
            try {
                await myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    },
                    ACT(_arr, after) {
                        after(null, () => validAfterCalled++);
                        throw "ok";
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => invalidAfterCalled++);
                        return 0;
                    }
                });
                throw new Error("Should throw error");
            } catch (e) {
                if (e !== "ok") {
                    throw e;
                }
            }
            Assert.strictEqual(validAfterCalled, 2, "Valid after should be called");
            Assert.strictEqual(invalidAfterCalled, 0, "Invalid afters should not be called");
        });
        test("should call all 'afters' if arrange_after fails", async () => {
            let validAfterCalled = 0;
            const myTest = newRoot();
            try {
                await myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => {
                            throw "ok";
                        });
                        return 0;
                    },
                    ACT(_arr, after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    }
                });
                throw new Error("Should throw error");
            } catch (e) {
                if (e !== "ok") {
                    throw e;
                }
            }
            Assert.strictEqual(validAfterCalled, 2, "Valid after should be called");
        });
        test("should call all 'afters' if act_after fails", async () => {
            let validAfterCalled = 0;
            const myTest = newRoot();
            try {
                await myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    },
                    ACT(_arr, after) {
                        after(null, () => {
                            throw "ok";
                        });
                        return 0;
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    }
                });
                throw new Error("Should throw error");
            } catch (e) {
                if (e !== "ok") {
                    throw e;
                }
            }
            Assert.strictEqual(validAfterCalled, 2, "Valid after should be called");
        });
        test("should call all 'afters' if assert_after fails", async () => {
            let validAfterCalled = 0;
            const myTest = newRoot();
            try {
                await myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    },
                    ACT(_arr, after) {
                        after(null, () => validAfterCalled++);
                        return 0;
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => {
                            throw "ok";
                        });
                        return 0;
                    }
                });
                throw new Error("Should throw error");
            } catch (e) {
                if (e !== "ok") {
                    throw e;
                }
            }
            Assert.strictEqual(validAfterCalled, 2, "Valid after should be called");
        });
    });
    test.describe("Should notify parent process", () => {
        // Arrange
        function getProcessSend() {
            const oldAAA = process.env.AAA_TEST_FILE;
            process.env.AAA_TEST_FILE = "1";
            const oldSend = process.send;
            const formatter = getFormatter();
            process.send = (msg:unknown) => {
                if (isMessage(msg)) {
                    formatter.cb(msg.data);
                }
                return true;
            };
            test.after(() => {
                process.env.AAA_TEST_FILE = oldAAA;
                process.send = oldSend;
            });
            const root = newRoot();
            return { formatter, root };
        }
        test.test("should work if no existing process", async () => {
            // Arrange
            const myTest = newRoot();
            const oldProcess = global.process;
            global.process = undefined as any;
            test.after(() => {
                global.process = oldProcess;
                newRoot();
            });

            // Act/Assert (should not crash)
            await myTest.test("test", {
                ARRANGE() {
                    return 0;
                },
                ACT() {
                    return 0;
                },
                ASSERT() {
                    return "ok";
                }
            });
        });

        test.test("process.send is called", async () => {
            // Arrange
            const { formatter, root } = getProcessSend();

            // Act
            await root.test("test", {
                ARRANGE() {
                    return 0;
                },
                ACT() {
                    return 0;
                },
                ASSERT() {
                    return "ok";
                }
            });

            // Assert
            formatter.assert("after test", [{
                id: "+0",
                type: MessageType.ADDED,
                test: {
                    parentId: String(root.id),
                    description: "test",
                    type: TestType.TEST
                }
            }, {
                id: "+0",
                type: MessageType.START
            }, {
                id: "+1",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+1",
                type: MessageType.START
            }, {
                id: "+1",
                type: MessageType.END
            }, {
                id: "+0",
                type: MessageType.END
            }]);
        });

        test.test("end is called only once if a test is added after finish", async () => {
            // Arrange
            const { formatter, root } = getProcessSend();

            // Act
            await root.describe("describe", test => {
                setTimeout(10).then(() => {
                    test.test("test", {
                        ARRANGE() {
                            return 0;
                        },
                        ACT() {
                            return 0;
                        },
                        ASSERT() {
                            return "ok";
                        }
                    }).catch(() => {});
                });
            });
            await setTimeout(50);

            // Assert
            formatter.assert("after test", [{
                id: "+0",
                type: MessageType.ADDED,
                test: {
                    parentId: String(root.id),
                    description: "describe",
                    type: TestType.DESCRIBE
                }
            }, {
                id: "+0",
                type: MessageType.START
            }, {
                id: "+0",
                type: MessageType.END
            }]);
        });

        test.test("describe end is called only after tests are ended", async () => {
            // Arrange
            const { formatter, root } = getProcessSend();

            // Act
            await root.describe("describe", test => {
                test.test("test1", {
                    ARRANGE() {
                        return 0;
                    },
                    ACT() {
                        return 0;
                    },
                    async ASSERT() {
                        await setTimeout(20);
                        return "ok";
                    }
                }).catch(() => {});
                test.test("test2", {
                    ARRANGE() {
                        return 0;
                    },
                    ACT() {
                        return 0;
                    },
                    ASSERT() {
                        return "ok";
                    }
                }).catch(() => {});
            });

            // Assert
            formatter.assert("after test", [{
                id: "+0",
                type: MessageType.ADDED,
                test: {
                    parentId: String(root.id),
                    description: "describe",
                    type: TestType.DESCRIBE
                }
            }, {
                id: "+0",
                type: MessageType.START
            }, {
                id: "+1",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "test1",
                    type: TestType.TEST
                }
            }, {
                id: "+1",
                type: MessageType.START
            }, {
                id: "+2",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "test2",
                    type: TestType.TEST
                }
            }, {
                id: "+3",
                type: MessageType.ADDED,
                test: {
                    parentId: "+1",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+3",
                type: MessageType.START
            }, {
                id: "+3",
                type: MessageType.END
            }, {
                id: "+1",
                type: MessageType.END
            }, {
                id: "+2",
                type: MessageType.START
            }, {
                id: "+4",
                type: MessageType.ADDED,
                test: {
                    parentId: "+2",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+4",
                type: MessageType.START
            }, {
                id: "+4",
                type: MessageType.END
            }, {
                id: "+2",
                type: MessageType.END
            }, {
                id: "+0",
                type: MessageType.END
            }]);
        });

        test("should show nested error logs", async () => {
            // Arrange
            const { formatter, root } = getProcessSend();

            // Act
            const promise = root.describe("describe", test => {
                test.test("test1", {
                    ARRANGE() {
                        return 0;
                    },
                    ACT() {
                        return 0;
                    },
                    async ASSERT() {
                        await setTimeout(20);
                        throw "ok";
                    }
                }).catch(() => {});
                test.test("test2", {
                    ARRANGE() {
                        return 0;
                    },
                    ACT() {
                        return 0;
                    },
                    ASSERT() {
                        return "ok";
                    }
                }).catch(() => {});
            });

            // Assert
            await Assert.rejects(promise, e => e === "ok");
            formatter.assert("after test", [{
                id: "+0",
                type: MessageType.ADDED,
                test: {
                    parentId: String(root.id),
                    description: "describe",
                    type: TestType.DESCRIBE
                }
            }, {
                id: "+0",
                type: MessageType.START
            }, {
                id: "+1",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "test1",
                    type: TestType.TEST
                }
            }, {
                id: "+1",
                type: MessageType.START
            }, {
                id: "+2",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "test2",
                    type: TestType.TEST
                }
            }, {
                id: "+3",
                type: MessageType.ADDED,
                test: {
                    parentId: "+1",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+3",
                type: MessageType.START
            }, {
                id: "+3",
                type: MessageType.END,
                error: "ok"
            }, {
                id: "+1",
                type: MessageType.END,
                error: "ok"
            }, {
                id: "+2",
                type: MessageType.START
            }, {
                id: "+4",
                type: MessageType.ADDED,
                test: {
                    parentId: "+2",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+4",
                type: MessageType.START
            }, {
                id: "+4",
                type: MessageType.END
            }, {
                id: "+2",
                type: MessageType.END
            }, {
                id: "+0",
                type: MessageType.END,
                error: "ok"
            }]);
        });
    });
    test.describe("Should run test files", () => {
        // Assert
        function newFormatter() {
            const formatter = getFormatter();
            const root = newRoot();
            root.setFormatter({
                format: (_fileId, msg) => {
                    formatter.cb(msg);
                }
            });
            test.after(() => newRoot());
            return { formatter, root };
        }
        async function runTest(spawn = false) {
            // Arrange
            const { formatter, root } = newFormatter();
            const rootId = spawn ? "0" : root.id;
            const check:CheckMessages[] = [{
                id: "+0",
                type: MessageType.ADDED,
                test: {
                    parentId: String(rootId),
                    description: "assertNumber1",
                    type: TestType.DESCRIBE
                }
            }, {
                id: "+0",
                type: MessageType.START
            }, {
                id: "+1",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "should work",
                    type: TestType.TEST
                }
            }, {
                id: "+1",
                type: MessageType.START
            }, {
                id: "+2",
                type: MessageType.ADDED,
                test: {
                    parentId: "+0",
                    description: "should not work",
                    type: TestType.TEST
                }
            }, {
                id: "+3",
                type: MessageType.ADDED,
                test: {
                    parentId: "+1",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+3",
                type: MessageType.START
            }, {
                id: "+3",
                type: MessageType.END
            }, {
                id: "+1",
                type: MessageType.END
            }, {
                id: "+2",
                type: MessageType.START
            }, {
                id: "+4",
                type: MessageType.ADDED,
                test: {
                    parentId: "+2",
                    description: "",
                    type: TestType.ASSERT
                }
            }, {
                id: "+4",
                type: MessageType.START
            }, {
                id: "+4",
                type: MessageType.END
            }, {
                id: "+2",
                type: MessageType.END
            }, {
                id: "+0",
                type: MessageType.END
            }];
            if (spawn) {
                check.unshift({
                    type: MessageType.FILE_START
                });
                check.push({
                    type: MessageType.FILE_END
                });
            }

            // Act
            if (spawn) {
                await root.spawnTestFile(mockFiles["file1.mytest-ok"], { prefix: [] });
            } else {
                root.runTestFile(mockFiles["file1.mytest-ok"], {
                    clearModuleCache: true
                });
            }
            await root.run();

            // Assert
            formatter.assert("after test", check);
        }
        test("should run a test file", async () => {
            await runTest();
        });
        test("should spawn a test file", async () => {
            await runTest(true);
        });
    });
});