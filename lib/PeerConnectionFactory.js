'use strict';

var Utils = require("cyclon.p2p-common");
var PeerConnection = require("./PeerConnection");

function PeerConnectionFactory(rtcObjectFactory, asyncExecService, loggingService) {

    Utils.checkArguments(arguments, 3);

    //
    // Please, for the sake of the experiment, if you're reading this can you
    // not share the details of the TURN server with anyone. It's only an Amazon
    // micro instance and probably won't cope with massive load.
    //
    // Thanks, Nick T
    //

    //
    // Early Firefox WebRTC implementations didn't support DNS lookups for STUN/TURN servers so we use IP address
    //
    // see: https://bugzilla.mozilla.org/show_bug.cgi?id=843644
    //
    var peerConnectionConfig = {'iceServers': [
        rtcObjectFactory.createIceServer('stun:stun.l.google.com:19302'),                                           // The Google STUN server
        rtcObjectFactory.createIceServer('turn:54.187.115.223:80?transport=tcp', 'cyclonjsuser', 'sP4zBGasNVKI')    // Turn over TCP on port 80 for networks with totalitarian security regimes
    ].filter(function (item) {
            return item !== null;       // createIceServer sometimes returns null (when the browser doesn't support the URL
        })
    };

    if (peerConnectionConfig.iceServers.length === 0) {
        loggingService.warn("Your browser doesn't support any of the configured ICE servers. You will only be able to contact other peers on your LAN.");
    }

    /**
     * Create a new peer connection
     */
    this.createPeerConnection = function () {
        return new PeerConnection(rtcObjectFactory.createRTCPeerConnection(peerConnectionConfig), asyncExecService, rtcObjectFactory, loggingService);
    };
}

module.exports = PeerConnectionFactory;
