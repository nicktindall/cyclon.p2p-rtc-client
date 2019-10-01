export interface RTCObjectFactory {

    createIceServers(urls: string[] | string, username: string | undefined, password: string | undefined): RTCIceServer[];

    createRTCSessionDescription(sessionDescriptionString: RTCSessionDescriptionInit): RTCSessionDescription | null;

    createRTCIceCandidate(rtcIceCandidateString: RTCIceCandidateInit): RTCIceCandidate | null;

    createRTCPeerConnection(config: RTCConfiguration): RTCPeerConnection | null;
}