const { Coverage } = require("../../../lib/coverage/Coverage");
import * as Mock from "./coverage.mock.file";
export async function run() {
    const coverage = new Coverage();
    await coverage.start();
    Mock.pepe(1, 2);
    try {
        return await coverage.takeCoverage();
    } finally {
        await coverage.stop();
    }
}