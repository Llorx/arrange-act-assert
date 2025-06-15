import * as Http from "http";
import * as Https from "https";

export function getHttpFile(url:string, ca?:string) {
    const proto = url.startsWith("https:") ? Https : Http;
    return new Promise<string>((resolve, reject) => {
        const request = proto.get(url, {
            ca: ca
        }, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Http code: ${response.statusCode}`));
            } else {
                const chunks:Buffer[] = [];
                let size = 0;
                response.on("data", chunk => {
                    chunks.push(chunk);
                    size += chunk.length;
                });
                response.on("end", () => {
                    resolve(Buffer.concat(chunks, size).toString("utf8"));
                });
                response.on("error", reject);
            }
        });
        request.on("error", reject);
        request.end();
    });
}