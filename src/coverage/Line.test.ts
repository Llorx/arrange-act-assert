import test from "arrange-act-assert";

import { Line } from "./Line";

test.describe("Line", test => {
    function newLine(...ranges:[start:number, end:number, count:number][]) {
        const line = new Line(0, 100, false);
        for (const range of ranges) {
            line.count(...range);
        }
        return line;
    }
    test("should add first range", {
        ARRANGE() {
            return newLine();
        },
        SNAPSHOT(line) {
            line.count(10, 20, 1);
            return line.getRanges(true);
        }
    });
    test("should get full line if ignored", {
        ARRANGE() {
            return new Line(0, 100, true);
        },
        SNAPSHOT(line) {
            return line.getRanges(true);
        }
    });
    test("should get full line if partially counted but ignored", {
        ARRANGE() {
            const line = new Line(0, 100, true);
            line.count(10, 20, 1);
            return line
        },
        SNAPSHOT(line) {
            return line.getRanges(true);
        }
    });
    test.describe("insert between start (new.end <= old.end && new.start > old.start)", test => {
        function doTest(count:number) {
            const merge = count === 1 ? "merge" : count === 0 ? "clear" : "split";
            const text = count === 1 ? "same" : count === 0 ? "none" : "different";
            test.describe(`${text} count`, test => {
                test(`should ${merge} previous overlapping range with exactly the end [old[oldnew| [x]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(11, 20, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} previous overlapping range inside the block [old[new]old] [x]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(11, 19, count);
                        return line.getRanges(true);
                    }
                });
            });
        }
        doTest(0);
        doTest(1);
        doTest(2);
    });
    test.describe("insert start (new.end <= old.end)", test => {
        function doTest(count:number) {
            const merge = count === 1 ? "merge" : count === 0 ? "clear" : "add";
            const text = count === 1 ? "same" : count === 0 ? "none" : "different";
            test.describe(`${text} count`, test => {
                test("should add previous range with non-overlapping end [new] [old] [x]", {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(0, 9, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} previous overlapping range with exactly the end [new|old] [x]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(0, 10, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} previous overlapping range with exceeding the end [newold] [x]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(0, 11, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} previous overlapping range with exactly the start and end |newold| [x]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(10, 20, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} previous overlapping range with exactly the start and smaller end |newold]old] [x]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(10, 15, count);
                        return line.getRanges(true);
                    }
                });
                test("should overwrite previous range that wraps the full block [new[oldnew|", {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(0, 20, count);
                        return line.getRanges(true);
                    }
                });
            });
        }
        doTest(0);
        doTest(1);
        doTest(2);
    });
    test.describe("insert end (old.start >= end.start)", test => {
        function doTest(count:number) {
            const merge = count === 1 ? "merge" : count === 0 ? "clear" : "add";
            const text = count === 1 ? "same" : count === 0 ? "none" : "different";
            test.describe(`${text} count`, test => {
                test("should add next range with non-overlapping start [x] [old] [new]", {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(41, 50, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} next overlapping range with exactly the start [x] [old|new]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(40, 50, count);
                        return line.getRanges(true);
                    }
                });
                test(`should ${merge} next overlapping range with exceeding the start [x] [oldnew]`, {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(39, 50, count);
                        return line.getRanges(true);
                    }
                });
                test("should overwrite next range that overlaps the full block[x] |newold]new]", {
                    ARRANGE() {
                        return newLine([10, 20, 1], [30, 40, 1]);
                    },
                    SNAPSHOT(line) {
                        line.count(30, 50, count);
                        return line.getRanges(true);
                    }
                });
            });
        }
        doTest(0);
        doTest(1);
        doTest(2);
    });
    test.describe("multiple blocks", test => {
        test("should merge multiple counts when start is equal", {
            ARRANGE() {
                return newLine([10, 20, 1], [20, 30, 2]);
            },
            SNAPSHOT(line) {
                line.count(20, 25, 3);
                return line.getRanges(true);
            }
        });
        test("should merge multiple counts when end is equal", {
            ARRANGE() {
                return newLine([10, 20, 1], [20, 30, 2]);
            },
            SNAPSHOT(line) {
                line.count(15, 20, 3);
                return line.getRanges(true);
            }
        });
        test("should merge multiple counts overlapping 2 blocks", {
            ARRANGE() {
                return newLine([10, 20, 1], [20, 30, 2]);
            },
            SNAPSHOT(line) {
                line.count(19, 25, 3);
                return line.getRanges(true);
            }
        });
        test("should get an empty line if partial branch happens", {
            ARRANGE() {
                return newLine([10, 20, 1], [20, 30, 2]);
            },
            SNAPSHOT(line) {
                return line.getRanges(false);
            }
        });
        test("should get full line if no partial branch happens", {
            ARRANGE() {
                return newLine([0, 10, 1], [10, 100, 2]);
            },
            SNAPSHOT(line) {
                return line.getRanges(false);
            }
        });
    });
});