import {SignallingServerSpec} from "./SignallingServerSpec";

/**
 * Just returns a list of known signalling servers
 */
export class StaticSignallingServerService {

    constructor(private readonly signallingServers: SignallingServerSpec[]) {
    }

    getSignallingServerSpecs(): SignallingServerSpec[] {
        return this.signallingServers;
    }

    getPreferredNumberOfSockets(): number {
        return Math.min(2, this.signallingServers.length);
    }
}