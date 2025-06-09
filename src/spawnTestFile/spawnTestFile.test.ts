import * as Path from "path";

import { test, monad } from "arrange-act-assert";

import { spawnTestFile } from "./spawnTestFile";
import * as Mock from "./mock/spawnTestFile.mock";

test.describe("spawnTestFile", (test) => {
    test("Should spawn new process", {
        async ACT(_, after) {
            process.env.AAA_RUN = "1";
            after(null, () => delete process.env.AAA_RUN);
            await spawnTestFile(Mock.path, {prefix:[]}, () => {});
        }
    });
    test("Should fail when exit code", {
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