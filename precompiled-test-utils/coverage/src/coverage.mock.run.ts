const { Coverage } = require("../../../lib/coverage/Coverage"); // Avoid compilation of this file
export async function run() {
    const coverage = new Coverage();
    await coverage.start();
    require("./coverage.mock.file").pepe(1, 2);
    try {
        process.send && process.send({
            type: "aaa-test-coverage",
            coverage: await coverage.takeCoverage()
        });
    } finally {
        await coverage.stop();
    }
}
run();