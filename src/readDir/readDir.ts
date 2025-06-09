import * as Fs from "fs";
import * as Path from "path";
import { testRegex } from "../utils/utils";

export type ReadDirOptions = {
    include:RegExp[];
    exclude:RegExp[];
}
export async function readDir(folder:string, filter:ReadDirOptions) {
    const res:string[] = [];
    const files = await Fs.promises.readdir(folder, {
        withFileTypes: true
    });
    for (const file of files) {
        const path = Path.join(folder, file.name);
        if (!testRegex(path, filter.exclude)) {
            if (file.isFile()) {
                if (testRegex(path, filter.include)) {
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