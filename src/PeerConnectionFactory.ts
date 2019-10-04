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
        return new PeerConnection(this.rtcObjectFactory.createRTCPeerConnection(this.createPeerConnectionConfig()),
            this.rtcObjectFactory, this.logger, this.channelStateTimeout);
    }

    private createIceServers() {
        if (this.iceServers) {
            const builtIceServers = this.iceServers.map((iceServer) => {
                return this.rtcObjectFactory.createIceServers(Array.isArray(iceServer.urls) ? iceServer.urls : [iceServer.urls], iceServer.username, iceServer.credential as string);
            }).reduce(PeerConnectionFactory.flatten, []).filter(PeerConnectionFactory.notNull);     // createIceServer sometimes returns null (when the browser doesn't support the URL

            if (builtIceServers.length === 0) {
                this.logger.warn("Your browser doesn't support any of the configured ICE servers. You will only be able to contact other peers on your LAN.");
            }
            return builtIceServers;
        }

        return [];
    }

    private createPeerConnectionConfig() {
        return {
            iceServers: this.createIceServers()
        };
    }

    private static notNull(item: any) {
        return item !== null;
    }

    private static flatten(prev: any[], next: any[]) {
        return prev.concat(next);
    }
}
