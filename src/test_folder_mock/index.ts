import * as Path from "path";

export const mockFiles = {
    "index": __filename,
    "file1": Path.join(__dirname, "file1.js"),
    "re-evaluation": Path.join(__dirname, "re-evaluation.js"),
    "file1.mytest-ok": Path.join(__dirname, "file1.mytest-ok.js"),
    "file1.mytest-invalid": Path.join(__dirname, "file1.mytest-invalid.js"),
    "file2": Path.join(__dirname, "test_subfolder_mock", "file2.js"),
    "file2.mytest-ok": Path.join(__dirname, "test_subfolder_mock", "file2.mytest-ok.js")
};