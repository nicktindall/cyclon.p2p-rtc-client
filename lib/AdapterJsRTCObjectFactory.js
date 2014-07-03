'use strict';

/**
 *	An RTC Object factory that works in Firefox and Chrome when adapter.js is present
 */
function AdapterJsRTCObjectFactory() {

	this.createIceServer = function(url, username, password) {
		return createIceServer(url, username, password);
	};

    this.createRTCSessionDescription = function (sessionDescriptionString) {
        return new RTCSessionDescription(sessionDescriptionString);
    };

    this.createRTCIceCandidate = function (rtcIceCandidateString) {
        return new RTCIceCandidate(rtcIceCandidateString);
    };

    this.createRTCPeerConnection = function(config) {
    	return new RTCPeerConnection(config);
    };
}

module.exports = AdapterJsRTCObjectFactory;