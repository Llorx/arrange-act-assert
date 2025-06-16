import type * as InspectorI from "inspector";
let Inspector:typeof InspectorI|null = null;
try {
    Inspector = require("inspector");
} catch (e) {
    console.error(e);
}

export class Coverage {
    private _session:InspectorI.Session|null = null;
    start() {
        return new Promise<void>((resolve, reject) => {
            if (this._session || !Inspector) {
                return resolve();
            }
            this._session = new Inspector.Session();
            this._session.connect();
            this._session.post("Profiler.enable", (err) => {
                if (err) {
                    this._session && this._session.disconnect();
                    this._session = null;
                    reject(err);
                } else {
                    if (!this._session) {
                        return resolve();
                    }
                    this._session.post("Profiler.startPreciseCoverage", {
                        callCount: true,
                        detailed: true
                    }, err => {
                        if (err) {
                            if (!this._session) {
                                return reject(err);
                            }
                            this._session.post("Profiler.disable", () => {
                                this._session && this._session.disconnect();
                                this._session = null;
                                reject(err);
                            });
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }
    takeCoverage() {
        return new Promise<InspectorI.Profiler.ScriptCoverage[]>((resolve, reject) => {
            if (!this._session) {
                return reject("No session enabled");
            }
            this._session.post("Profiler.takePreciseCoverage", (err, coverage) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        resolve(coverage.result.filter(entry => entry.url.startsWith("file:")));
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    stop() {
        return new Promise<void>(resolve => {
            if (!this._session) {
                return resolve();
            }
            this._session.post("Profiler.stopPreciseCoverage", () => {
                if (!this._session) {
                    return resolve();
                }
                this._session.post("Profiler.disable", () => {
                    this._session && this._session.disconnect();
                    this._session = null;
                    resolve();
                });
            });
        });
    }
}