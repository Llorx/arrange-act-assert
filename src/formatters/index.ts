import * as Inspector from "inspector";

import { Summary } from "../testRunner/testRunner";
import { CoverageOptions } from "../coverage/processCoverage";

export const enum TestType {
    TEST,
    DESCRIBE,
    ASSERT
}
export const enum MessageType {
    FILE_START,
    FILE_END,
    ADDED,
    START,
    END,
    COVERAGE
}
export type TestInfo = {
    parentId:number;
    description:string;
    type:TestType;
};
export type MessageBase = {
    id:number;
};
export type MessageCoverage = {
    type:MessageType.COVERAGE;
    coverage:Inspector.Profiler.ScriptCoverage[];
};
export type MessageFileStart = {
    type:MessageType.FILE_START;
};
export type MessageFileEnd = {
    type:MessageType.FILE_END;
};
export type MessageAdded = MessageBase & {
    type:MessageType.ADDED;
    test:TestInfo;
};
export type MessageStart = MessageBase & {
    type:MessageType.START;
};
export type MessageEnd = MessageBase & {
    type:MessageType.END;
    error?:string;
};
export type Messages = MessageCoverage | MessageFileStart | MessageFileEnd | MessageAdded | MessageStart | MessageEnd;

export type FormatterOptions = {
    excludeFiles:string[];
    exclude:RegExp[];
    branches:boolean;
};
export interface Formatter {
    formatSummary?(summary:Summary, coverageOptions:CoverageOptions):void|Promise<void>;
    format(fileId:string, msg:Messages):void;
}