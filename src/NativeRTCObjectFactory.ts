import {Logger} from 'cyclon.p2p-common';
import {RTCObjectFactory} from './RTCObjectFactory';

/**
 * An RTC Object factory that works in Firefox 37+ and Chrome 
 */
export class NativeRTCObjectFactory implements RTCObjectFactory {

    constructor(private readonly logger: Logger) {
    }

    createIceServers(urls: string[], username: string, password: string): RTCIceServer {
        return {
            'urls': urls,
            'username': username,
            'credentialType': 'password',
            'credential': password
        };
    };

    createRTCSessionDescription(sessionDescriptionString: RTCSessionDescriptionInit): RTCSessionDescription | null {
        if (typeof(RTCSessionDescription) !== "undefined") {
            return new RTCSessionDescription(sessionDescriptionString);
        }
        else {
            this.logger.error("Your browser doesn't support WebRTC");
            return null;
        }
    };

    createRTCIceCandidate(rtcIceCandidateString: RTCIceCandidateInit): RTCIceCandidate | null {
        if (typeof(RTCIceCandidate) !== "undefined") {
            return new RTCIceCandidate(rtcIceCandidateString);
        }
        else {
            this.logger.error("Your browser doesn't support WebRTC");
            return null;
        }
    };

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection | null {
        if (typeof(RTCPeerConnection) !== "undefined") {
            return new RTCPeerConnection(config);
        }
        else {
            this.logger.error("Your browser doesn't support WebRTC");
            return null;
        }
    };
}
