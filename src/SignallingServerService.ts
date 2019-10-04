import {SignallingServerSpec} from "./SignallingServerSpec";

export interface SignallingServerService {
    getSignallingServerSpecs(): SignallingServerSpec[];

    getPreferredNumberOfSockets(): number;
}