import {SignallingServerSpec} from "./SignallingServerSpec";
import {SignallingServerService} from './SignallingServerService';

/**
 * Just returns a list of known signalling servers
 */
export class StaticSignallingServerService implements SignallingServerService {

    constructor(private readonly signallingServers: SignallingServerSpec[]) {
    }

    getSignallingServerSpecs(): SignallingServerSpec[] {
        return this.signallingServers;
    }

    getPreferredNumberOfSockets(): number {
        return Math.min(2, this.signallingServers.length);
    }
}