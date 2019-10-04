import {Logger} from 'cyclon.p2p-common';
import {SignallingService} from './SignallingService';
import {Channel} from './Channel';
import {PeerConnectionFactory} from "./PeerConnectionFactory";
import {WebRTCCyclonNodePointer} from "./WebRTCCyclonNodePointer";

export class ChannelFactory {

    constructor(private readonly peerConnectionFactory: PeerConnectionFactory,
                private readonly signallingService: SignallingService,
                private readonly logger: Logger,
                private readonly channelStateTimeoutMs: number) {
    }

    createChannel(remotePeer: WebRTCCyclonNodePointer, correlationId?: number): Channel {
        return new Channel(
            remotePeer,
            correlationId,
            this.peerConnectionFactory.createPeerConnection(),
            this.signallingService,
            this.logger,
            this.channelStateTimeoutMs);
    }
}

