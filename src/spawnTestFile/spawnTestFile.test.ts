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
        ARRANGE() {
            return Path.join(__dirname, "not_test_file.js");
        },
        ACT(path) {
            return monad(() => spawnTestFile(path, {prefix:[]}, () => {}));
        },
        ASSERT(res, path) {
            res.should.error({
                message: new RegExp(`Test file '${path.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}'.*Cannot find module`, "s")
            });
        }
    });
    test("Should spawn with a prefix", {
        ARRANGE() {
            return Path.join(__dirname, "not_test_file.js");
        },
        ACT(path) {
            return monad(() => spawnTestFile(path, {prefix:["--aaa-prefix-test"]}, () => {}));
        },
        ASSERT(res, path) {
            res.should.error({
                message: new RegExp(`Test file '${path.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}'.*bad option: --aaa-prefix-test`, "s")
            });
        }
    });
});