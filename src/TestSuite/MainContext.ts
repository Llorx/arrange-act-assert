import { ReadDirOptions, readDir } from "../readDir/readDir";
import { TestSuiteContext } from "./TestSuite";

export class MainContext implements TestSuiteContext {
    getFiles(path:string, filter:ReadDirOptions) {
        return readDir(path, filter);
    }
}