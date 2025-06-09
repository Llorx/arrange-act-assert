const { Coverage } = require("../../../lib/coverage/Coverage");
import * as Mock from "./coverage.mock.file";
async function run() {
    const coverage = new Coverage();
    await coverage.start();
    Mock.pepe(1, 2);
    process.send!({
        type: "aaa-coverage",
        coverage: await coverage.takeCoverage()
    });
    await coverage.stop();
}
run();