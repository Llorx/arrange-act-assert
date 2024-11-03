import { test } from "node:test";

import { DefaultFormatter, STYLE } from "./default";
import { MessageType, TestType } from ".";

test.describe("default formatter", () => {
    // Arrange
    class LogChecker {
        logs:string[] = [];
        log(msg:string) {
            this.logs.push(msg);
        }
        assert(type:string, check:unknown[][]) {
            const checkLogs = check.map(line => line.join(" "));
            const logs = this.logs.map(msg => {
                return msg.replaceAll(STYLE.BOLD, "")
                    .replaceAll(STYLE.GREEN, "")
                    .replaceAll(STYLE.YELLOW, "")
                    .replaceAll(STYLE.RED, "")
                    .replaceAll(STYLE.RESET, "");
            });
            if (JSON.stringify(logs) !== JSON.stringify(checkLogs)) {
                console.log("Expected:", checkLogs);
                console.log("Found:", logs);
                throw new Error(`${type} logs are different`);
            }
            this.logs.splice(0);
        }
    }
    function newChecker() {
        const logChecker = new LogChecker();
        const formatter = new DefaultFormatter((...args) => logChecker.log(...args));
        let ids = 0;
        const ret = {
            addTest(parent = -1) {
                const id = ++ids;
                formatter.format("", {
                    type: MessageType.ADDED,
                    id: id,
                    test: {
                        parentId: parent,
                        description: String(id),
                        type: TestType.TEST
                    }
                });
                return {
                    id: id,
                    start() {
                        formatter.format("", {
                            type: MessageType.START,
                            id: id
                        });
                    },
                    end(error?:string) {
                        formatter.format("", {
                            type: MessageType.END,
                            id: id,
                            error: error
                        });
                    },
                    addTest() {
                        return ret.addTest(id);
                    }
                }
            },
            assert(...args:Parameters<typeof logChecker.assert>) {
                return logChecker.assert(...args);
            }
        };
        return ret;
    }
    test("should not show logs after start", () => {
        // Arrange
        const checker = newChecker();
        const test1 = checker.addTest();

        // Act
        test1.start();

        // Assert
        checker.assert("After start", []);
    });

    test("should show logs after end", () => {
        // Arrange
        const checker = newChecker();
        const test1 = checker.addTest();

        // Act
        test1.start();
        test1.end();

        // Assert
        checker.assert("After end", [["√", test1.id]]);
    });

    test("should show logs after nested started", () => {
        // Arrange
        const checker = newChecker();
        const test1 = checker.addTest();
        const test1child = test1.addTest();

        // Act
        test1.start();
        test1child.start();

        // Assert
        checker.assert("After end", [["►", test1.id]]);
    });

    test("should show end logs after nested ended", () => {
        // Arrange
        const checker = newChecker();
        const test1 = checker.addTest();
        const test1child = test1.addTest();

        // Act
        test1.start();
        test1child.start();
        test1child.end();
        test1.end();

        // Assert
        checker.assert("After end", [
            ["►", test1.id],
            ["  √", test1child.id],
            ["√", test1.id]
        ]);
    });

    test("should show end logs in starting order", () => {
        // Arrange
        const checker = newChecker();
        const test1 = checker.addTest();
        const test2 = checker.addTest();

        // Act
        test1.start();
        test2.start();
        test2.end();
        test1.end();

        // Assert
        checker.assert("After end", [
            ["√", test1.id],
            ["√", test2.id]
        ]);
    });

    test("should show end logs in nested starting order", () => {
        // Arrange
        const checker = newChecker();
        const test1 = checker.addTest();
        const test1child = test1.addTest();
        const test2 = checker.addTest();
        const test2child1 = test2.addTest();
        const test2child2 = test2.addTest();

        // Act
        test1.start();
        test2.start();
        test2child1.start();
        test2child2.start();
        test2child2.end();
        test2child1.end();
        test2.end();
        test1child.start();
        test1child.end();
        test1.end();

        // Assert
        checker.assert("After end", [
            ['►', test1.id],
            ['  √', test1child.id],
            ['√', test1.id],
            ['►', test2.id],
            ['  √', test2child1.id],
            ['  √', test2child2.id],
            ['√', test2.id]
        ]);
    });
    test("should show all in order after root starts and ends", () => {
        // Arrange
        const checker = newChecker();
        const testRoot = checker.addTest();
        const test1child1 = testRoot.addTest();
        const test1child1child = test1child1.addTest();
        const subtest1 = test1child1child.addTest();
        const subtest2 = test1child1child.addTest();
        const subtest3 = test1child1child.addTest();

        // Act
        testRoot.start();
        test1child1.start();
        test1child1child.start();
        subtest1.start();
        subtest1.end();
        subtest2.start();
        subtest2.end();
        subtest3.start();
        subtest3.end();
        test1child1child.end();
        test1child1.end();
        testRoot.end();

        // Assert
        checker.assert("After end", [
            ['►', testRoot.id],
            ['  ►', test1child1.id],
            ['    ►', test1child1child.id],
            ['      √', subtest1.id],
            ['      √', subtest2.id],
            ['      √', subtest3.id],
            ['    √', test1child1child.id],
            ['  √', test1child1.id],
            ['√', testRoot.id]
        ]);
    });
});