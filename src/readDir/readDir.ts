import * as Fs from "fs";
import * as Path from "path";

export type ReadDirOptions = {
    include:RegExp[];
    exclude:RegExp[];
}
function testRegex(paths:string[], regex:RegExp[]) {
    for (const path of paths) {
        for (const r of regex) {
            if (r.test(path)) {
                return true;
            }
        }
    }
    return false;
}
export async function readDir(folder:string, filter:ReadDirOptions) {
    const res:string[] = [];
    const files = await Fs.promises.readdir(folder, {
        withFileTypes: true
    });
    for (const file of files) {
        const path = Path.join(folder, file.name);
        const fullPathForward = path.replace(/\\/g, "/");
        const fullPathBackward = path.replace(/\//g, "\\");
        if (!testRegex([fullPathForward, fullPathBackward], filter.exclude)) {
            if (file.isFile()) {
                if (testRegex([fullPathForward, fullPathBackward], filter.include)) {
                    res.push(path);
                }
            } else {
                try {
                    const files = await readDir(path, filter);
                    res.push(...files);
                } catch (e) {}
            }
        }
    }
    return res;
}