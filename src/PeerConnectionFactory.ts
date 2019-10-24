import {Logger} from 'cyclon.p2p-common';
import {RTCObjectFactory} from './RTCObjectFactory';
import {PeerConnection} from './PeerConnection';

export class PeerConnectionFactory {

    constructor(private readonly rtcObjectFactory: RTCObjectFactory,
                private readonly logger: Logger,
                private readonly iceServers: RTCIceServer[],
                private readonly channelStateTimeout: number) {
    }

    /**
     * Create a new peer connection
     */
    createPeerConnection() {
        return new PeerConnection(this.rtcObjectFactory.createRTCPeerConnection({
                iceServers: this.iceServers || []
            }),
            this.rtcObjectFactory, this.logger, this.channelStateTimeout);
    }
}
