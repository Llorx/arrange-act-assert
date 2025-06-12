const { Coverage } = require("../../../lib/coverage/Coverage");
import * as Mock from "./coverage.mock.file";
export async function run(withSourceMaps:boolean) {
    const coverage = new Coverage();
    await coverage.start();
    Mock.pepe(1, 2);
    try {
        return await coverage.takeCoverage({
            excludeFiles: [],
            exclude: [/^(?!.*coverage\.mock\.file).*/i],
            branches: true,
            sourceMaps: withSourceMaps
        });
    } finally {
        await coverage.stop();
    }
}