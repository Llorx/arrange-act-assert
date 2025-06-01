import * as Fs from "fs";
import * as Os from "os";
import * as Path from "path";
import * as Assert from "assert";
import { setTimeout } from "timers/promises";

import test, { After, asyncMonad, TestFunction } from "arrange-act-assert";

import { isMessage, newRoot, TestOptions } from "./testRunner";
import { MessageType, MessageFileStart, MessageFileEnd, MessageAdded, MessageStart, MessageEnd, Messages, TestType } from "../formatters";

import { mockFiles } from "../test_folder_mock";

type CheckMessages = MessageFileStart | MessageFileEnd | ({ id:string } & ((Omit<MessageAdded, "id"|"test"> & { test: { parentId:string } & Omit<MessageAdded["test"], "parentId"> }) | Omit<MessageStart, "id"> | Omit<MessageEnd, "id">));

test.describe("testRunner", (test) => {
    function afterNewRoot(after:After, options?:TestOptions) {
        after(process.env.AAA_TEST_FILE, oldAAA => {
            process.env.AAA_TEST_FILE = oldAAA
        });
        process.env.AAA_TEST_FILE = ""; // Do not notify parent process
        return newRoot(options);
    }
    function stepped(steps:number[] = []) {
        return {
            clone() {
                return stepped(steps.slice());
            },
            up(value:number) {
                steps.push(value);
            },
            assert(value:number) {
                const arr = new Array(value + 1).fill(0).map((_, i) => i);
                Assert.deepStrictEqual(steps, arr);
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
            assert(check:(CheckMessages)[]) {
                for (const msg of check) {
                    if ("id" in msg) {
                        msg.id = eval(`${msg.id.startsWith("+") ? firstId : ""}${msg.id}`);
                        if (msg.type === MessageType.ADDED) {
                            msg.test.parentId = eval(`${msg.test.parentId.startsWith("+") ? firstId : ""}${msg.test.parentId}`);
                        }
                    }
                }
                Assert.deepStrictEqual(messages, check);
                messages.splice(0);
            }
        };
    }
    test.describe("Should run in order", (test) => {
        test("ARRANGE -> ACT -> ASSERT", {
            ARRANGE(after) {
                const step = stepped();
                const myTest = afterNewRoot(after);
                return { step, myTest };
            },
            async ACT({ myTest, step }) {
                await myTest.test("Should run in order", {
                    ARRANGE() {
                        step.up(0);
                    },
                    ACT() {
                        step.up(1);
                    },
                    ASSERT() {
                        step.up(2);
                    }
                });
            },
            ASSERT(_, { step }) {
                step.assert(2);
            }
        });
        test("ARRANGE -> ACT -> ASSERT and reversed afters", {
            ARRANGE(after) {
                const step = stepped();
                const myTest = afterNewRoot(after);
                return { step, myTest };
            },
            async ACT({ myTest, step }) {
                await myTest.test("Should run in order with after", {
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
            },
            ASSERT(_, { step }) {
                step.assert(5);
            }
        });
        test("within describes", {
            ARRANGE(after) {
                const step = stepped();
                const myTest = afterNewRoot(after);
                return { step, myTest };
            },
            async ACT({ step, myTest }) {
                const descDelayed1 = myTest.describe("describe delayed", async (test) => {
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
                await Promise.all([desc, descDelayed1, descDelayed2]);
            },
            ASSERT(_, { step }) {
                step.assert(11);
            }
        });
        test("not allow tests after finishing", {
            async ARRANGE() {
                const resolvedTest = await new Promise<TestFunction>((resolve) => {
                    newRoot().describe("", test => {
                        test("empty", {
                            ASSERT() {}
                        });
                        resolve(test);
                    });
                });
                await setTimeout(10); // Wait for "finally" resolve
                return resolvedTest;
            },
            async ACT(resolvedTest) {
                return await asyncMonad(() => resolvedTest.test("test", {
                    ARRANGE() {
                        return 0;
                    },
                    ACT() {
                        return 0;
                    },
                    ASSERT() {
                        return "ok";
                    }
                }));
            },
            ASSERT(res) {
                res.should.error({
                    message: /This test is closed/
                });
            }
        });
    });
    test.describe("Should infer data", (test) => {
        test.describe("from arrange", (test) => {
            test("to act", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null} = {
                        act: null,
                        assert: null
                    };
                    await myTest.test("", {
                        ARRANGE() {
                            return { pepe: 123 };
                        },
                        ACT(arrange) {
                            res.act = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: 123,
                        assert: null
                    });
                }
            });
            test("to assert", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null} = {
                        act: null,
                        assert: null
                    };
                    await myTest.test("", {
                        ARRANGE() {
                            return { pepe: 123 };
                        },
                        ASSERT(_, arrange) {
                            res.assert = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: null,
                        assert: 123
                    });
                }
            });
            test("to act and assert", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null} = {
                        act: null,
                        assert: null
                    };
                    await myTest.test("", {
                        ARRANGE() {
                            return { pepe: 123 };
                        },
                        ACT(arrange) {
                            res.act = arrange.pepe;
                        },
                        ASSERT(_, arrange) {
                            res.assert = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: 123,
                        assert: 123
                    });
                }
            });
            test("to after", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null, after:number|null} = {
                        act: null,
                        assert: null,
                        after: null
                    };
                    await myTest.test("", {
                        ARRANGE(after) {
                            return after({ pepe: 123 }, arrange => {
                                res.after = arrange.pepe
                            });
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: null,
                        assert: null,
                        after: 123
                    });
                }
            });
            test("to after and act", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null, after:number|null} = {
                        act: null,
                        assert: null,
                        after: null
                    };
                    await myTest.test("", {
                        ARRANGE(after) {
                            return after({ pepe: 123 }, arrange => {
                                res.after = arrange.pepe
                            });
                        },
                        ACT(arrange) {
                            res.act = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: 123,
                        assert: null,
                        after: 123
                    });
                }
            });
            test("to after and assert", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null, after:number|null} = {
                        act: null,
                        assert: null,
                        after: null
                    };
                    await myTest.test("", {
                        ARRANGE(after) {
                            return after({ pepe: 123 }, arrange => {
                                res.after = arrange.pepe
                            });
                        },
                        ASSERT(_, arrange) {
                            res.assert = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: null,
                        assert: 123,
                        after: 123
                    });
                }
            });
            test("to after, act and assert", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{act:number|null, assert:number|null, after:number|null} = {
                        act: null,
                        assert: null,
                        after: null
                    };
                    await myTest.test("", {
                        ARRANGE(after) {
                            return after({ pepe: 123 }, arrange => {
                                res.after = arrange.pepe
                            });
                        },
                        ACT(arrange) {
                            res.act = arrange.pepe;
                        },
                        ASSERT(_, arrange) {
                            res.assert = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        act: 123,
                        assert: 123,
                        after: 123
                    });
                }
            });
        });
        test.describe("from act", (test) => {
            test("to assert", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{assert:number|null} = {
                        assert: null
                    };
                    await myTest.test("", {
                        ACT() {
                            return { pepe: 123 };
                        },
                        ASSERT(arrange) {
                            res.assert = arrange.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        assert: 123
                    });
                }
            });
            test("to after", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{assert:number|null, after:number|null} = {
                        assert: null,
                        after: null
                    };
                    await myTest.test("", {
                        ACT(_, after) {
                            return after({ pepe: 123 }, arrange => {
                                res.after = arrange.pepe
                            });
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        assert: null,
                        after: 123
                    });
                }
            });
            test("to after and assert", {
                ARRANGE(after) {
                    return afterNewRoot(after);
                },
                async ACT(myTest) {
                    const res:{assert:number|null, after:number|null} = {
                        assert: null,
                        after: null
                    };
                    await myTest.test("", {
                        ACT(_, after) {
                            return after({ pepe: 123 }, arrange => {
                                res.after = arrange.pepe
                            });
                        },
                        ASSERT(act) {
                            res.assert = act.pepe;
                        }
                    });
                    return res;
                },
                ASSERT(res) {
                    Assert.deepStrictEqual(res, {
                        assert: 123,
                        after: 123
                    });
                }
            });
        });
        test("from arrange and act to act and assert", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res:{act:number|null, assertAct:number|null, assertArrange:number|null} = {
                    act: null,
                    assertAct: null,
                    assertArrange: null,
                };
                await myTest.test("", {
                    ARRANGE() {
                        return { pepe: 123 };
                    },
                    ACT(arrange) {
                        res.act = arrange.pepe;
                        return { pepe2: 124 }
                    },
                    ASSERT(act, arrange) {
                        res.assertAct = act.pepe2;
                        res.assertArrange = arrange.pepe;
                    }
                });
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    act: 123,
                    assertAct: 124,
                    assertArrange: 123
                });
            }
        });
        test("from assert to after", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res:{after:number|null} = {
                    after: null
                };
                await myTest.test("", {
                    ASSERT(_act, _arr, after) {
                        after({ pepe: 123 }, assert => {
                            res.after = assert.pepe;
                        })
                    }
                });
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    after: 123
                });
            }
        });
    });
    test.describe("Error managing", (test) => {
        test("should throw error if describe fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            ACT(myTest) {
                const promise = myTest.describe("describe", () => {
                    throw new Error("ok");
                });
                return { promise };
            },
            async ASSERT({ promise }) {
                await Assert.rejects(promise, {
                    message: "ok"
                });
            }
        });
        test("should not call act/assert 'after()' if arrange fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res = {
                    valid: 0,
                    invalid: 0
                };
                await asyncMonad(() => myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => res.valid++);
                        throw "ok";
                    },
                    ACT(_arr, after) {
                        after(null, () => res.invalid++);
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => res.invalid++);
                    }
                }));
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    valid: 1,
                    invalid: 0
                });
            }
        });
        test("should not call assert 'after' if act fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res = {
                    valid: 0,
                    invalid: 0
                };
                await asyncMonad(() => myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => res.valid++);
                    },
                    ACT(_arr, after) {
                        after(null, () => res.valid++);
                        throw "ok";
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => res.invalid++);
                    }
                }));
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    valid: 2,
                    invalid: 0
                });
            }
        });
        test("should call all 'afters' if arrange_after fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res = {
                    valid: 0,
                    invalid: 0
                };
                await asyncMonad(() => myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => res.valid++);
                    },
                    ACT(_arr, after) {
                        after(null, () => res.valid++);
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => res.valid++);
                        throw "ok";
                    }
                }));
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    valid: 3,
                    invalid: 0
                });
            }
        });
        test("should call all 'afters' if arrange_after fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res = {
                    valid: 0,
                    invalid: 0
                };
                await asyncMonad(() => myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => {
                            throw "ok";
                        });
                    },
                    ACT(_arr, after) {
                        after(null, () => res.valid++);
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => res.valid++);
                    }
                }));
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    valid: 2,
                    invalid: 0
                });
            }
        });
        test("should call all 'afters' if act_after fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res = {
                    valid: 0,
                    invalid: 0
                };
                await asyncMonad(() => myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => res.valid++);
                    },
                    ACT(_arr, after) {
                        after(null, () => {
                            throw "ok";
                        });
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => res.valid++);
                    }
                }));
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    valid: 2,
                    invalid: 0
                });
            }
        });
        test("should call all 'afters' if assert_after fails", {
            ARRANGE(after) {
                return afterNewRoot(after);
            },
            async ACT(myTest) {
                const res = {
                    valid: 0,
                    invalid: 0
                };
                await asyncMonad(() => myTest.test("test", {
                    ARRANGE(after) {
                        after(null, () => res.valid++);
                    },
                    ACT(_arr, after) {
                        after(null, () => res.valid++);
                    },
                    ASSERT(_act, _arr, after) {
                        after(null, () => {
                            throw "ok";
                        });
                    }
                }));
                return res;
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, {
                    valid: 2,
                    invalid: 0
                });
            }
        });
    });
    test.describe("Should notify parent process", (test) => {
        function getProcessSend(after:After) {
            after(process.env.AAA_TEST_FILE, oldAAA => {
                process.env.AAA_TEST_FILE = oldAAA
            });
            process.env.AAA_TEST_FILE = "1";
            after(process.send, oldSend => {
                process.send = oldSend
            });
            const formatter = getFormatter();
            process.send = (msg:unknown) => {
                if (isMessage(msg)) {
                    formatter.cb(msg.data);
                }
                return true;
            };
            const root = newRoot();
            return { formatter, root };
        }
        test.test("process.send is called", {
            ARRANGE(after) {
                return getProcessSend(after);
            },
            async ACT({ root }) {
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
            },
            ASSERT(_, { formatter, root }) {
                formatter.assert([{
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
            }
        });
        test.test("end is called only once if a test is added after finish", {
            ARRANGE(after) {
                return getProcessSend(after);
            },
            async ACT({ root }) {
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
            },
            ASSERT(_, { formatter, root }) {
                formatter.assert([{
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
            }
        });
        test.test("describe end is called only after tests are ended", {
            ARRANGE(after) {
                return getProcessSend(after);
            },
            async ACT({ root }) {
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
                await setTimeout(50);
            },
            ASSERT(_, { formatter, root }) {
                formatter.assert([{
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
            }
        });
        test("should show nested error logs", {
            ARRANGE(after) {
                return getProcessSend(after);
            },
            ACT({ root }) {
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
                return { promise };
            },
            ASSERTS: {
                async "promise should fail with error"({ promise }) {
                    await Assert.rejects(promise, e => e === "ok");
                },
                "formatter should receive the events in order"(_, { formatter, root }) {
                    formatter.assert([{
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
                }
            }
        });
    });
    test.describe("Should run test files", (test) => {
        function newFormatter(after:After) {
            const formatter = getFormatter();
            const root = afterNewRoot(after);
            root.setFormatter({
                format: (_fileId, msg) => {
                    formatter.cb(msg);
                }
            });
            return { formatter, root };
        }
        async function runTest(testName:string, spawn = false) {
            test(testName, {
                ARRANGE(after) {
                    return newFormatter(after);
                },
                async ACT({ root }) {
                    if (spawn) {
                        await root.spawnTestFile(mockFiles["file1.mytest-ok"], { prefix: [] });
                    } else {
                        root.runTestFile(mockFiles["file1.mytest-ok"], {
                            clearModuleCache: true
                        });
                    }
                    await root.run();
                },
                ASSERT(_, { formatter, root }) {
                    const rootId = spawn ? "0" : root.id;
                    const check:CheckMessages[] = [{
                        id: "+0",
                        type: MessageType.ADDED,
                        test: {
                            parentId: String(rootId),
                            description: "assertNumber1 (test inside test, obviate)",
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
                            description: "should work (test inside test, obviate)",
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
                            description: "should not work (test inside test, obviate)",
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
                    formatter.assert(check);
                }
            });
        }
        runTest("should run a test file");
        runTest("should spawn a test file", true);
    });
    test.describe("snapshots", test => {
        async function tempFolder(after:After) {
            return after(await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), "aaa-tests-")), folder => Fs.promises.rm(folder, { recursive: true, force: true }));
        }
        test.describe("single", test => {
            test("should ask to confirm a snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Confirm snapshot:/
                    });
                }
            });
            test("should create a snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                async ACT({ myTest }) {
                    await myTest.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    });
                },
                async ASSERT(_, { snapshotsFolder }) {
                    await Fs.promises.statfs(Path.join(snapshotsFolder, "test snapshot"));
                }
            });
            test("should ask to review an existent snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        reviewSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Review snapshot:/
                    });
                }
            });
            test("should test a valid snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.ok();
                }
            });
            test("should test an invalid snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 1 };
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        SNAPSHOT() {
                            return { asd: 2 };
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Expected values to be strictly deep-equal(.|\r|\n)*asd: 1/
                    });
                }
            });
        });
        test.describe("multiple", test => {
            test("should ask to confirm a snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Confirm snapshot:/
                    });
                }
            });
            test("should create snapshots", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                async ACT({ myTest }) {
                    await myTest.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    });
                },
                ASSERTS: {
                    async "should create asd1 snapshot"(_, { snapshotsFolder }) {
                        await Fs.promises.statfs(Path.join(snapshotsFolder, "test snapshot", "asd1"));
                    },
                    async "should create asd2 snapshot"(_, { snapshotsFolder }) {
                        await Fs.promises.statfs(Path.join(snapshotsFolder, "test snapshot", "asd2"));
                    }
                }
            });
            test("should ask to review an existent snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        reviewSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Review snapshot:/
                    });
                }
            });
            test("should test multiple valid snapshots", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.ok();
                }
            });
            test("should test first invalid snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        ACT() {
                            return { asd1: 2, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Expected values to be strictly deep-equal(.|\r|\n)*2 !== 1/
                    });
                }
            });
            test("should test second invalid snapshot", {
                async ARRANGE(after) {
                    const snapshotsFolder = await tempFolder(after);
                    const myTest1 = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    await myTest1.test("test snapshot", {
                        ACT() {
                            return { asd1: 1, asd2: 2 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    });
                    const myTest = afterNewRoot(after, {
                        snapshotsFolder: snapshotsFolder,
                        confirmSnapshots: true
                    });
                    return { myTest, snapshotsFolder };
                },
                ACT({ myTest }) {
                    return asyncMonad(() => myTest.test("test snapshot", {
                        ACT() {
                            return { asd1: 2, asd2: 1 };
                        },
                        SNAPSHOTS: {
                            "asd1"(res) {
                                return res.asd1;
                            },
                            "asd2"(res) {
                                return res.asd2;
                            }
                        }
                    }));
                },
                ASSERT(res) {
                    res.should.error({
                        message: /Expected values to be strictly deep-equal(.|\r|\n)*2 !== 1/
                    });
                }
            });
        });
    });
});