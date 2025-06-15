import * as Path from "path";
import * as Assert from "assert";
import * as Module from "module";

import test from "arrange-act-assert";

import getSourceMap from "./getSourceMap";

test.describe("getSourceMap", test => {
    function coverageJson() {
        return '{"version":3,"file":"coverage.mock.file2.js","sourceRoot":"","sources":["../src/coverage.mock.file.ts"],"names":[],"mappings":";;;AACA,oBAEC;AACD,sBAEC;AANY,QAAA,IAAI,GAAG,UAAU,CAAC;AAC/B,SAAgB,IAAI,CAAC,CAAQ,EAAE,CAAQ;IACnC,OAAO,CAAC,GAAG,CAAC,CAAC;AACjB,CAAC;AACD,SAAgB,KAAK,CAAC,CAAQ,EAAE,CAAQ;IACpC,OAAO,CAAC,GAAG,CAAC,CAAC;AACjB,CAAC"}';
    }
    function coverage() {
        const res = JSON.parse(coverageJson()) as Module.SourceMapPayload;
        res.file = Path.resolve(__dirname, res.file);
        res.sources = res.sources.map(file => Path.resolve(__dirname, file));
        return res;
    }
    function newBase64SourcemapData(format = "application/json;base64", coverage = Buffer.from(coverageJson()).toString("base64")) {
        return [
            "const test = 123;",
            `//# sourceMappingURL=data:${format},${coverage}`
        ].join("\n");
    }
    function newSourcemapData() {
        return newBase64SourcemapData("application/json", coverageJson());
    }
    function newSourcemapFile() {
        return [
            "const test = 123;",
            "//# sourceMappingURL=file.js.map"
        ].join("\n");
    }
    function newSourcemapHttp() {
        return [
            "const test = 123;",
            "//# sourceMappingURL=http://my.test.file"
        ].join("\n");
    }
    function newSourcemapHttps() {
        return [
            "const test = 123;",
            "//# sourceMappingURL=https://my.test.file"
        ].join("\n");
    }
    test.describe("sourcemap ok", test => {
        test("should process base64", {
            ARRANGE() {
                return newBase64SourcemapData();
            },
            ACT(code) {
                return getSourceMap(__dirname, code);
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, coverage());
            }
        });
        test("should process normal", {
            ARRANGE() {
                return newSourcemapData();
            },
            ACT(code) {
                return getSourceMap(__dirname, code);
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, coverage());
            }
        });
        test("should process file", {
            ARRANGE() {
                const sourceMap = newSourcemapFile();
                const readFile = async (file:string) => {
                    if (file === Path.join(__dirname, "file.js.map")) {
                        return JSON.stringify(await getSourceMap(__dirname, newBase64SourcemapData()))
                    } else {
                        throw new Error("error");
                    }
                };
                return { sourceMap, readFile };
            },
            ACT({ sourceMap, readFile }) {
                return getSourceMap(__dirname, sourceMap, { readFile });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, coverage());
            }
        });
        test("should process http", {
            async ARRANGE() {
                const sourceMap = newSourcemapHttp();
                const getHttpFile = async (url:string) => {
                    if (url === "http://my.test.file") {
                        return JSON.stringify(await getSourceMap(__dirname, newBase64SourcemapData()))
                    } else {
                        throw new Error("error");
                    }
                };
                return { sourceMap, getHttpFile };
            },
            ACT({ sourceMap, getHttpFile }) {
                return getSourceMap(__dirname, sourceMap, { getHttpFile });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, coverage());
            }
        });
        test("should process https", {
            async ARRANGE() {
                const sourceMap = newSourcemapHttps();
                const getHttpFile = async (url:string) => {
                    if (url === "https://my.test.file") {
                        return JSON.stringify(await getSourceMap(__dirname, newBase64SourcemapData()))
                    } else {
                        throw new Error("error");
                    }
                };
                return { sourceMap, getHttpFile };
            },
            ACT({ sourceMap, getHttpFile }) {
                return getSourceMap(__dirname, sourceMap, { getHttpFile });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, coverage());
            }
        });
    });
    test.describe("sourcemap error", test => {
        test("should error base64", {
            ARRANGE() {
                return newBase64SourcemapData("application/json;base64", "asd");
            },
            ACT(code) {
                return getSourceMap(__dirname, code);
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, null);
            }
        });
        test("should error normal", {
            ARRANGE() {
                return newBase64SourcemapData("application/json", "asd");
            },
            ACT(code) {
                return getSourceMap(__dirname, code);
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, null);
            }
        });
        test("should error file", {
            ARRANGE() {
                const sourceMap = newSourcemapFile();
                const readFile = () => {
                    throw new Error("error");
                };
                return { sourceMap, readFile };
            },
            ACT({ sourceMap, readFile }) {
                return getSourceMap(__dirname, sourceMap, { readFile });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, null);
            }
        });
        test("should error http", {
            async ARRANGE() {
                const sourceMap = newSourcemapHttp();
                const getHttpFile = () => {
                    throw new Error("error");
                };
                return { sourceMap, getHttpFile };
            },
            ACT({ sourceMap, getHttpFile }) {
                return getSourceMap(__dirname, sourceMap, { getHttpFile });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, null);
            }
        });
        test("should error https", {
            async ARRANGE() {
                const sourceMap = newSourcemapHttps();
                const getHttpFile = () => {
                    throw new Error("error");
                };
                return { sourceMap, getHttpFile };
            },
            ACT({ sourceMap, getHttpFile }) {
                return getSourceMap(__dirname, sourceMap, { getHttpFile });
            },
            ASSERT(res) {
                Assert.deepStrictEqual(res, null);
            }
        });
    });
});