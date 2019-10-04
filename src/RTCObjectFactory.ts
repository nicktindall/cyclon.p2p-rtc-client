export interface RTCObjectFactory {

    createIceServers(urls: string[] | string, username: string | undefined, password: string | undefined): RTCIceServer[];

    createRTCSessionDescription(sessionDescriptionString: RTCSessionDescriptionInit): RTCSessionDescription;

    createRTCIceCandidate(rtcIceCandidateString: RTCIceCandidateInit): RTCIceCandidate;

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection;
}