import * as Path from "path";

import { test, monad } from "arrange-act-assert";

import { spawnTestFile } from "./spawnTestFile";

test.describe("spawnTestFile", (test) => {
    test("Should spawn new process", {
        async ACT() {
            await spawnTestFile(Path.join(__dirname, "spawnTestFile.mock.test.js"), {prefix:[]}, () => {});
        }
    });
    test("Should fail with exit code", {
        ACT() {
            return monad(() => spawnTestFile(Path.join(__dirname, "not_test_file.js"), {prefix:[]}, () => {}));
        },
        ASSERT(res) {
            res.should.error({
                message: /Cannot find module/
            });
        }
    });
    test("Should spawn with a prefix", {
        ACT() {
            return monad(() => spawnTestFile(Path.join(__dirname, "not_test_file.js"), {prefix:["--aaa-prefix-test"]}, () => {}));
        },
        ASSERT(res) {
            res.should.error({
                message: /bad option: --aaa-prefix-test/
            });
        }
    });
});