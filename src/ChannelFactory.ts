import {Logger} from 'cyclon.p2p-common';
import {SignallingService} from './SignallingService';
import {CyclonNodePointer} from 'cyclon.p2p';
import {Channel} from './Channel';
import {PeerConnectionFactory} from "./PeerConnectionFactory";

export class ChannelFactory {

    constructor(private readonly peerConnectionFactory: PeerConnectionFactory,
                private readonly signallingService: SignallingService,
                private readonly logger: Logger,
                private readonly channelStateTimeoutMs: number) {
    }

    createChannel(remotePeer: CyclonNodePointer, correlationId: number) {
        return new Channel(
            remotePeer,
            correlationId,
            this.peerConnectionFactory.createPeerConnection(),
            this.signallingService,
            this.logger,
            this.channelStateTimeoutMs);
    }
}

