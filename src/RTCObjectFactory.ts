export interface RTCObjectFactory {

    createIceServers(urls: string[], username: string, password: string): RTCIceServer;

    createRTCSessionDescription(sessionDescriptionString: RTCSessionDescriptionInit): RTCSessionDescription | null;

    createRTCIceCandidate(rtcIceCandidateString: RTCIceCandidateInit): RTCIceCandidate | null;

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection | null;
}