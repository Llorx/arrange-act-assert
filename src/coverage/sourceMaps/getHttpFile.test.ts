import * as Assert from "assert";
import * as Http from "http";
import * as Https from "https";
import * as Net from "net";

import test, { After, monad } from "arrange-act-assert";

import { getHttpFile } from "./getHttpFile";

test.describe("getHttpFile", test => {
    const testPrivateKey = '-----BEGIN PRIVATE KEY-----\n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\nCJEK6Pjk7Oy+w8e5Pfq+cL+q6UcBcA==\n-----END PRIVATE KEY-----';
    const testCert = '-----BEGIN CERTIFICATE-----\n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\n-----END CERTIFICATE-----';
    function startServer(after:After, https:boolean, files:Record<string, string>) {
        return new Promise<number>((res, rej) => {
            const server = after(https ? Https.createServer({
                key: testPrivateKey,
                cert: testCert
            }, (req, res) => {
                if (files[req.url!]) {
                    res.end(files[req.url!] || "");
                } else {
                    res.writeHead(404);
                    res.end();
                }
            }) : Http.createServer((req, res) => {
                if (files[req.url!]) {
                    res.end(files[req.url!] || "");
                } else {
                    res.writeHead(404);
                    res.end();
                }
            }), server => new Promise<any>(res => server.close(res)));
            server.on("error", rej);
            server.listen(0, "127.0.0.1", () => {
                res((server.address() as Net.AddressInfo).port)
            });
        });
    }
    test("should get an http file", {
        ARRANGE(after) {
            return startServer(after, false, {
                "/myFile": "ok"
            });
        },
        ACT(port) {
            return getHttpFile(`http://127.0.0.1:${port}/myFile`);
        },
        ASSERT(res) {
            Assert.strictEqual(res, "ok");
        }
    });
    test("should get an https file", {
        ARRANGE(after) {
            return startServer(after, true, {
                "/myFile": "ok"
            });
        },
        ACT(port) {
            return getHttpFile(`https://127.0.0.1:${port}/myFile`, testCert);
        },
        ASSERT(res) {
            Assert.strictEqual(res, "ok");
        }
    });
    test("should error on http", {
        ARRANGE(after) {
            return startServer(after, false, {});
        },
        ACT(port) {
            return monad(() => getHttpFile(`http://127.0.0.1:${port}/myFile`));
        },
        ASSERT(res) {
            res.should.error({
                message: /404/
            });
        }
    });
    test("should error on https", {
        ARRANGE(after) {
            return startServer(after, true, {});
        },
        ACT(port) {
            return monad(() => getHttpFile(`https://127.0.0.1:${port}/myFile`, testCert));
        },
        ASSERT(res) {
            res.should.error({
                message: /404/
            });
        }
    });
});