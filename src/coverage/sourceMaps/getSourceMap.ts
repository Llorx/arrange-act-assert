import * as Url from "url";
import * as Path from "path";
import * as Module from "module";
import * as Fs from "fs";

import { getHttpFile } from "./getHttpFile";

const sourcemapMatch = /\/[*/]#\s+sourceMappingURL=(?<sourceMappingURL>[^\s]+)/g;
const protocolMatch = /^(?<protocol>[a-zA-Z]+)\:(?<data>[\s\S]+)/;

function extractSourceMapURLMagicComment(content:string) {
    const match = content.match(sourcemapMatch)?.at(-1);
    if (match == null) {
        return null;
    }
    return match.substring(match.indexOf("=") + 1);
}
function isSourceMap(sourceMap:any):sourceMap is Module.SourceMapPayload {
    return typeof sourceMap.file === "string" &&
        Array.isArray(sourceMap.sources) &&
        (sourceMap.sourceRoot == null || typeof sourceMap.sourceRoot === "string") &&
        typeof sourceMap.version === "number" &&
        typeof sourceMap.mappings === "string";
}
function urlToFile(file:string) {
    try {
        return Url.fileURLToPath(file);
    } catch (e) {
        return file;
    }
}
function processSourceMap(folder:string, sourceMapString:string) {
    const sourceMap = JSON.parse(sourceMapString);
    if (isSourceMap(sourceMap)) {
        for (let i = 0; i < sourceMap.sources.length; i++) {
            let source = urlToFile(sourceMap.sources[i]!);
            const sourceRoot = urlToFile(sourceMap.sourceRoot || "");
            if (sourceRoot) {
                source = Path.join(sourceRoot, source);
            }
            sourceMap.sources[i] = Path.resolve(folder, source);
        }
        sourceMap.sourceRoot = "";
        sourceMap.file = Path.resolve(folder, sourceMap.file);
        return sourceMap;
    }
    return null;
}
function getSourceMapFromData(folder:string, data:string) {
    const formatIndex = data.indexOf(",");
    if (formatIndex > -1) {
        const format = data.substring(0, formatIndex).split(";");
        let sourceMapString = data.substring(formatIndex + 1);
        switch (format[0]) {
            case "application/json": {
                if (format[format.length - 1] === "base64") {
                    sourceMapString = Buffer.from(sourceMapString, "base64").toString("utf8");
                }
                return processSourceMap(folder, sourceMapString);
            }
        }
    }
}
async function getSourceMapFromFile(folder:string, file:string, readFile:GetSourceMapContext["readFile"]) {
    try {
        return processSourceMap(folder, await readFile(file));
    } catch (e) {}
    return null;
}
async function getSourceMapFromHttp(folder:string, url:string, getHttpFile:GetSourceMapContext["getHttpFile"]) {
    try {
        return processSourceMap(folder, await getHttpFile(url));
    } catch (e) {}
    return null;
}
async function processSourceMapUrl(folder:string, sourceMapURL:string, context:GetSourceMapContext) {
    const protocol = sourceMapURL.match(protocolMatch);
    if (protocol && protocol.groups) {
        switch (protocol.groups.protocol) {
            case "data": {
                const sourceMap = getSourceMapFromData(folder, protocol.groups.data!);
                if (sourceMap) {
                    return sourceMap;
                }
            }
            case "https":
            case "http": {
                const sourceMap = await getSourceMapFromHttp(folder, sourceMapURL, context.getHttpFile);
                if (sourceMap) {
                    return sourceMap;
                }
            }
        }
    }
    return await getSourceMapFromFile(folder, Path.resolve(folder, sourceMapURL), context.readFile);
}
export type GetSourceMapContext = {
    readFile(file:string):Promise<string>;
    getHttpFile(url:string):Promise<string>;
};
export default async function getSourceMap(folder:string, code:string, context?:Partial<GetSourceMapContext>) {
    try {
        const sourceMapURL = extractSourceMapURLMagicComment(code);
        if (sourceMapURL) {
            const data = await processSourceMapUrl(folder, sourceMapURL, {
                readFile: file => Fs.promises.readFile(file, "utf8"),
                getHttpFile: getHttpFile,
                ...context
            });
            if (data) {
                return data;
            }
        }
    } catch (e) {}
    return null;
}