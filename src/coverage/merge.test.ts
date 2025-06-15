import * as Assert from "assert";

import test from "arrange-act-assert";

import merge from "./merge";
import { CoverageEntry } from "./processCoverage";

test.describe("merge", test => {
    test("should return an empty lines coverage", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: []
            }];
            return [coverage1];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: []
            }]);
        }
    });
    test("should return an empty lines coverage when merging two empty files", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: []
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: []
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: []
            }]);
        }
    });
    test("should merge the error", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: []
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: "error",
                lines: []
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: "error",
                lines: []
            }]);
        }
    });
    test("should merge different files", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: []
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file2",
                error: "error",
                lines: []
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: []
            }, {
                file: "file2",
                error: "error",
                lines: []
            }]);
        }
    });
    test("should merge different lines", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: []
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }]
            }]);
        }
    });
    test("should merge different lines when second file have different lines", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }, {
                    length: 11,
                    ranges: []
                }]
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }, {
                    length: 11,
                    ranges: []
                }]
            }]);
        }
    });
    test("should merge line lengths", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }, {
                    length: 10,
                    ranges: []
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 11,
                    ranges: []
                }, {
                    length: 9,
                    ranges: []
                }]
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 11,
                    ranges: []
                }, {
                    length: 10,
                    ranges: []
                }]
            }]);
        }
    });
    test("should merge ranges", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 5,
                        end: 8,
                        count: 2
                    }]
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: []
                }]
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 5,
                        end: 8,
                        count: 2
                    }]
                }]
            }]);
        }
    });
    test("should merge ranges when they overlap", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 5,
                        end: 8,
                        count: 2
                    }]
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 4,
                        end: 9,
                        count: 2
                    }]
                }]
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 4,
                        end: 5,
                        count: 2
                    }, {
                        start: 5,
                        end: 8,
                        count: 4
                    }, {
                        start: 8,
                        end: 9,
                        count: 2
                    }]
                }]
            }]);
        }
    });
    test("should merge ranges when they overlap partially", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 5,
                        end: 8,
                        count: 2
                    }]
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 7,
                        end: 9,
                        count: 2
                    }]
                }]
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 5,
                        end: 7,
                        count: 2
                    }, {
                        start: 7,
                        end: 8,
                        count: 4
                    }, {
                        start: 8,
                        end: 9,
                        count: 2
                    }]
                }]
            }]);
        }
    });
    test("should merge ranges with holes", {
        ARRANGE() {
            const coverage1:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 1,
                        end: 2,
                        count: 2
                    }]
                }]
            }];
            const coverage2:CoverageEntry[] = [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 8,
                        end: 11,
                        count: 2
                    }]
                }]
            }];
            return [coverage1, coverage2];
        },
        ACT(coverage) {
            return merge(coverage);
        },
        ASSERT(res) {
            Assert.deepStrictEqual(res, [{
                file: "file1",
                error: null,
                lines: [{
                    length: 10,
                    ranges: [{
                        start: 1,
                        end: 2,
                        count: 2
                    }, {
                        start: 8,
                        end: 11,
                        count: 2
                    }]
                }]
            }]);
        }
    });
});