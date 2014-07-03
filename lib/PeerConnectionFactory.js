'use strict';

var Utils = require("cyclon.p2p").Utils;
var PeerConnection = require("./PeerConnection");

function PeerConnectionFactory(timingService, rtcObjectFactory, asyncExecService, loggingService) {

    Utils.checkArguments(arguments, 4);

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
        rtcObjectFactory.createIceServer('turn:54.187.115.223:3478', 'cyclonjsuser', 'sP4zBGasNVKI'),                // Plain old vanilla TURN over UDP
        rtcObjectFactory.createIceServer('turn:54.187.115.223:443?transport=tcp', 'cyclonjsuser', 'sP4zBGasNVKI')    // Turn over TCP on 443 for networks with totalitarian security regimes
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
        return new PeerConnection(rtcObjectFactory.createRTCPeerConnection(peerConnectionConfig), asyncExecService, timingService, rtcObjectFactory, loggingService);
    };
}

module.exports = PeerConnectionFactory;