import type * as InspectorI from "inspector";
let Inspector:typeof InspectorI|null = null;
try {
    Inspector = require("inspector");
} catch (e) {
    console.error(e);
}

// Restarting coverage doesn't work as expected
export class Coverage {
    private _session:InspectorI.Session|null = null;
    private _enable(session:InspectorI.Session) {
        return new Promise<void>((resolve, reject) => {
            session.post("Profiler.enable", (err) => {
                if (err) {
                    this._disconnect(session);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    private _disable(session:InspectorI.Session) {
        return new Promise<void>(resolve => {
            session.post("Profiler.disable", resolve);
        });
    }
    private _disconnect(session:InspectorI.Session) {
        try {
            session.disconnect();
        } catch (e) {}
    }
    private _startPreciseCoverage(session:InspectorI.Session) {
        return new Promise<void>((resolve, reject) => {
            session.post("Profiler.startPreciseCoverage", {
                callCount: true,
                detailed: true
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    private _stopPreciseCoverage(session:InspectorI.Session) {
        return new Promise<void>(resolve => {
            session.post("Profiler.stopPreciseCoverage", resolve);
        });
    }
    
    private _takePreciseCoverage(session:InspectorI.Session) {
        return new Promise<InspectorI.Profiler.TakePreciseCoverageReturnType>((resolve, reject) => {
            session.post("Profiler.takePreciseCoverage", (err, coverage) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(coverage);
                }
            });
        });
    }
    async start() {
        if (this._session || !Inspector) {
            return;
        }
        this._session = new Inspector.Session();
        this._session.connect();
        await this._enable(this._session);
        if (!this._session) {
            return;
        }
        try {
            await this._startPreciseCoverage(this._session);
        } catch (e) {
            if (this._session) {
                await this._disable(this._session);
                if (this._session) {
                    this._disconnect(this._session);
                }
            }
            throw e;
        }
    }
    async takeCoverage() {
        if (!this._session) {
            throw new Error("No session enabled");
        }
        const coverage = await this._takePreciseCoverage(this._session);
        return coverage.result.filter(entry => entry.url.startsWith("file:"));
    }
    async stop() {
        if (!this._session) {
            return;
        }
        await this._stopPreciseCoverage(this._session);
        if (!this._session) {
            return;
        }
        await this._disable(this._session);
        if (!this._session) {
            return;
        }
        this._disconnect(this._session);
        this._session = null;
    }
}