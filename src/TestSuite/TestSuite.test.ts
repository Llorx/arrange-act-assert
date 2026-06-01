import * as Fs from "fs";
import * as Os from "os";
import * as Path from "path";
import * as Assert from "assert";

import { monad, test, TestFunction } from "arrange-act-assert";

import { TestSuite } from "./TestSuite";
import { mockFiles } from "../test_folder_mock";

test.describe("TestSuite", (test) => {
    test("should validate parallel option", {
        ACT() {
            return monad(() => new TestSuite({
                parallel: -1
            }));
        },
        ASSERT(res) {
            res.should.error({
                message: "Invalid parallel option. Must be >= 0"
            });
        }
    });
    test("should process both options from options object and cli", {
        ARRANGE(after) {
            after(process.argv, argv => process.argv = argv);
            process.argv = ["--include-files", "mytest-ok"];
            return new TestSuite({
                parallel: 1,
                folder: Path.dirname(mockFiles["index"])
            });
        },
        async ACT(suite) {
            return await suite.run();
        },
        ASSERTS: {
            "should list test files"(res) {
                Assert.deepStrictEqual(res.files.sort(), [
                    mockFiles["file1.mytest-ok"],
                    mockFiles["file2.mytest-ok"]
                ].sort());
            },
            [`should ok`](res) {
                Assert.strictEqual(res.ok, true);
            }
        }
    });
    test.describe("run suite", (test) => {
        function run(test:TestFunction, message:string, parallel:number, error = false, invalid = false) {
            test(message, {
                ARRANGE(after) {
                    const suite = new TestSuite({
                        parallel: parallel,
                        include: invalid ? [/mytest/g] : [/mytest-ok/g],
                        folder: Path.dirname(mockFiles["index"]),
                        ...(parallel === 0 ? { clearModuleCache: true } : {})
                    });
                    if (error) {
                        process.env.ASSERT_NUMBER_1 = "2";
                        after(null, () => {
                            delete process.env.ASSERT_NUMBER_1;
                        });
                    }
                    return suite;
                },
                async ACT(suite) {
                    return await suite.run();
                },
                ASSERTS: {
                    "should list test files"(res) {
                        Assert.deepStrictEqual(res.files.sort(), [
                            mockFiles["file1.mytest-ok"],
                            mockFiles["file2.mytest-ok"],
                            ...(invalid ? [mockFiles["file1.mytest-invalid"]] : [])
                        ].sort());
                    },
                    [`should ok: ${!invalid && !error}`](res) {
                        Assert.strictEqual(res.ok, !invalid && !error);
                    }
                }
            });
        }
        test.describe("parallel", (test) => {
            run(test, "should run all test files", 1);
            run(test, "should error a test file", 1, true);
            run(test, "should handle invalid files", 1, false, true);
        });
        test.describe("same process", (test) => {
            run(test, "should run all test files", 0);
            run(test, "should error a test file", 0, true);
            run(test, "should handle invalid files", 0, false, true);
        });
    });
    test("forced exit: a test file that leaks a handle does not hang the suite", {
        async ARRANGE(after) {
            const dir = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), "aaa-leak-"));
            after(dir, d => Fs.promises.rm(d, { recursive: true, force: true }));
            // A spawned test whose ACT never settles AND leaks a live interval:
            // the per-callback timeout fails the test, but the leaked handle then
            // keeps the child's event loop alive so it can never drain. Only the
            // forced-exit safety net lets the child exit and the parent resume.
            const aaaIndex = Path.join(__dirname, "..", "index.js");
            await Fs.promises.writeFile(Path.join(dir, "leak.test.js"),
                `const test = require(${JSON.stringify(aaaIndex)}).default;\n` +
                `test("leaks a handle and hangs", {\n` +
                `    ACT() { setInterval(() => {}, 1000); return new Promise(() => {}); },\n` +
                `    ASSERT() {}\n` +
                `});\n`);
            return new TestSuite({
                parallel: 1,
                include: [/leak\.test/],
                folder: dir,
                timeout: 150,
                // Silent formatter without `formatSummary`: the leak fixture's
                // ACT times out before any assert runs, and the DefaultFormatter
                // would throw "No asserts run", masking what we want to observe.
                formatter: { format() {} }
            });
        },
        async ACT(suite) {
            // Without the forced exit this never resolves (the child hangs and
            // its `close` event never fires), so this test would time out.
            return await suite.run();
        },
        ASSERTS: {
            "run resolves instead of hanging"(res) {
                Assert.ok(res);
            },
            "suite is not ok"(res) {
                Assert.strictEqual(res.ok, false);
            },
            "the leaking file is reported as a run error"(res) {
                Assert.strictEqual(res.runErrors.length, 1);
            }
        }
    });
});