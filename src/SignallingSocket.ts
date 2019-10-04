import {SignallingService} from "./SignallingService";
import {SignallingServerSpec} from "./SignallingServerSpec";
import {EventEmitter} from "events";

export interface SignallingSocket extends EventEmitter {

    connect(localSignallingService: SignallingService, roomsToJoin: string[]): void;

    getCurrentServerSpecs(): SignallingServerSpec[];
}