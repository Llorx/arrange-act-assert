import TR from "./testRunner/testRunner";

export type { After, DescribeCallback, TestInterface, TestFunction, RunTestFileOptions, SummaryResult, Summary, TestOptions, Test } from "./testRunner/testRunner";
export * from "./TestSuite/TestSuite";
export * from "./monad/monad";

export default TR;
export const test = TR.test;
export const describe = TR.describe;
export const after = TR.after;