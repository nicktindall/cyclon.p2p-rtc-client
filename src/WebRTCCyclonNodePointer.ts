import {SignallingServerSpec} from "./SignallingServerSpec";
import {CyclonNodePointer} from "cyclon.p2p";

export interface WebRTCCyclonNodePointer extends CyclonNodePointer {
    signalling: SignallingServerSpec[]
}