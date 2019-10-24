export interface RTCObjectFactory {

    createRTCSessionDescription(sessionDescriptionString: RTCSessionDescriptionInit): RTCSessionDescription;

    createRTCIceCandidate(rtcIceCandidateString: RTCIceCandidateInit): RTCIceCandidate;

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection;
}