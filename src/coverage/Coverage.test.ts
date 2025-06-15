import * as Path from "path";
import * as Url from "url";
import * as Assert from "assert";
import * as Inspector from "inspector";

import test from "arrange-act-assert";

import { Coverage } from "./Coverage";

test.describe("Coverage", test => {
    function findCoverageFile(entries:Inspector.Profiler.ScriptCoverage[], file:string) {
        const fileUrl = Url.pathToFileURL(file).href;
        const mockFile = entries.find(({url}) => url === fileUrl);
        if (!mockFile) {
            throw new Error("Mock file not found");
        }
        mockFile.url = Path.basename(mockFile.url);
        return mockFile;
    }
    function testFunction(a:number, b:number) {
        return a + b;
    }
    test("should take function coverage", {
        async ARRANGE(after) {
            const coverage = after(new Coverage(), coverage => coverage.stop());
            await coverage.start();
            return coverage;
        },
        ACT(coverage) {
            testFunction(1, 2);
            return coverage.takeCoverage();
        },
        ASSERT(res) {
            const file = findCoverageFile(res, __filename);
            Assert.strictEqual(file.functions.find(entry => entry.functionName === testFunction.name)?.ranges[0]?.count, 1);
        }
    });
});