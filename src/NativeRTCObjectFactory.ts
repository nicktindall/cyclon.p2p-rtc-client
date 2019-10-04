import {Logger} from 'cyclon.p2p-common';
import {RTCObjectFactory} from './RTCObjectFactory';

/**
 * An RTC Object factory that works in Firefox 37+ and Chrome 
 */
export class NativeRTCObjectFactory implements RTCObjectFactory {

    constructor(private readonly logger: Logger) {
    }

    createIceServers(urls: string[], username: string, password: string): RTCIceServer[] {
        return [{
            'urls': urls,
            'username': username,
            'credentialType': 'password',
            'credential': password
        }];
    };

    createRTCSessionDescription(sessionDescriptionString: RTCSessionDescriptionInit): RTCSessionDescription {
        if (typeof(RTCSessionDescription) !== "undefined") {
            return new RTCSessionDescription(sessionDescriptionString);
        }
        else {
            throw new Error("Your browser doesn't support WebRTC");
        }
    };

    createRTCIceCandidate(rtcIceCandidateString: RTCIceCandidateInit): RTCIceCandidate {
        if (typeof(RTCIceCandidate) !== "undefined") {
            return new RTCIceCandidate(rtcIceCandidateString);
        }
        else {
            throw new Error("Your browser doesn't support WebRTC");
        }
    };

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection {
        if (typeof(RTCPeerConnection) !== "undefined") {
            return new RTCPeerConnection(config);
        }
        else {
            throw new Error("Your browser doesn't support WebRTC");
        }
    };
}
