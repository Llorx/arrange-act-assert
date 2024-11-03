import { Summary } from "../testRunner/testRunner";

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
    END
}
export type TestInfo = {
    parentId:number;
    description:string;
    type:TestType;
};
export type MessageBase = {
    id:number;
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
export type Messages = MessageFileStart | MessageFileEnd | MessageAdded | MessageStart | MessageEnd;

export interface Formatter {
    formatSummary?(summary:Summary):void;
    format(fileId:string, msg:Messages):void;
}