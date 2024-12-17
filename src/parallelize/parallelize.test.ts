// import { test } from "test";
import { setImmediate } from "timers/promises";
import * as Assert from "assert";

import test from "arrange-act-assert";

import { parallelize } from "./parallelize";

test.describe("parallelize", (test) => {
    test("should run all entries", {
        ARRANGE() {
            const elements = [0, 1, 2, 3, 4];
            function* consumer(elements:number[]) {
                while (true) {
                    const n = elements.shift();
                    if (n == null) {
                        break;
                    }
                    yield Promise.resolve(n);
                }
            }
            return { elements, consumer };
        },
        async ACT({ elements, consumer }) {
            await parallelize(2, consumer(elements));
        },
        ASSERT(_, { elements }) {
            Assert.deepStrictEqual(elements, []);
        }
    });
    test.describe("run entries in parallel (parallel: 2)", (test) => {
        function getWaiter() {
            const elements = [0, 1, 2, 3, 4];
            let waiting:(()=>void)[] = [];
            function* waiterConsumer(elements:number[]) {
                while (true) {
                    const n = elements.shift();
                    if (n == null) {
                        break;
                    }
                    yield new Promise<void>(resolve => waiting.push(resolve));
                }
            }
            async function runWaiting(assertSize:number) {
                if (waiting.length !== assertSize) {
                    throw new Error(`There should be ${assertSize} waiting tasks`);
                }
                waiting.splice(0).forEach(resolve => resolve());
                await setImmediate(); // Wait for promises to resolve
            }
            return { elements, waiterConsumer, runWaiting };
        }
        test("one iteration should process 2 elements", {
            ARRANGE() {
                return getWaiter();
            },
            ACT({ waiterConsumer, elements }) {
                parallelize(2, waiterConsumer(elements));
            },
            ASSERT(_, { elements }) {
                Assert.deepStrictEqual([2, 3, 4], elements);
            }
        });
        test("two iterations should process 4 elements", {
            ARRANGE() {
                return getWaiter();
            },
            async ACT({ waiterConsumer, elements, runWaiting }) {
                parallelize(2, waiterConsumer(elements));
                await runWaiting(2);
            },
            ASSERT(_, { elements }) {
                Assert.deepStrictEqual([4], elements);
            }
        });
        test("three iterations should process all elements", {
            ARRANGE() {
                return getWaiter();
            },
            async ACT({ waiterConsumer, elements, runWaiting }) {
                parallelize(2, waiterConsumer(elements));
                await runWaiting(2);
                await runWaiting(2);
            },
            ASSERT(_, { elements }) {
                Assert.deepStrictEqual([], elements);
            }
        });
        test("four iterations iterations should finish the parallelization", {
            ARRANGE() {
                return getWaiter();
            },
            async ACT({ waiterConsumer, elements, runWaiting }) {
                const promise = parallelize(2, waiterConsumer(elements));
                await runWaiting(2);
                await runWaiting(2);
                await runWaiting(1);
                await promise;
                return { promise };
            },
            async ASSERT({ promise }) {
                await Assert.doesNotReject(promise);
            }
        });
    });
    test("should return the states of all the promises", {
        ARRANGE() {
            const elements = [0, -1, 2, -1, 4];
            function* errorConsumer(elements:number[]) {
                while (true) {
                    const n = elements.shift();
                    if (n == null) {
                        break;
                    }
                    yield new Promise<number>((resolve, reject) => {
                        if (n === -1) {
                            reject(new Error("Invalid number"));
                        } else {
                            resolve(n);
                        }
                    });
                }
            }
            return { elements, errorConsumer };
        },
        async ACT({ elements, errorConsumer }) {
            return await parallelize(2, errorConsumer(elements));
        },
        ASSERT(parallelResult) {
            Assert.deepStrictEqual(parallelResult, [{
                status: "fulfilled",
                value: 0
            }, {
                status: "rejected",
                reason: new Error("Invalid number")
            }, {
                status: "fulfilled",
                value: 2
            }, {
                status: "rejected",
                reason: new Error("Invalid number")
            }, {
                status: "fulfilled",
                value: 4
            }]);
        }
    });
});