import {RTCObjectFactory} from './RTCObjectFactory';

/**
 * An RTC Object factory that works in Firefox 37+ and Chrome
 */
export class NativeRTCObjectFactory implements RTCObjectFactory {

    createRTCSessionDescription(sessionDescriptionInit: RTCSessionDescriptionInit): RTCSessionDescription {
        if (typeof (RTCSessionDescription) !== 'undefined') {
            return new RTCSessionDescription(sessionDescriptionInit);
        } else {
            throw new Error('Your browser doesn\'t support WebRTC');
        }
    };

    createRTCIceCandidate(rtcIceCandidateInit: RTCIceCandidateInit): RTCIceCandidate {
        if (typeof (RTCIceCandidate) !== 'undefined') {
            return new RTCIceCandidate(rtcIceCandidateInit);
        } else {
            throw new Error('Your browser doesn\'t support WebRTC');
        }
    };

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection {
        if (typeof (RTCPeerConnection) !== 'undefined') {
            return new RTCPeerConnection(config);
        } else {
            throw new Error('Your browser doesn\'t support WebRTC');
        }
    };
}
