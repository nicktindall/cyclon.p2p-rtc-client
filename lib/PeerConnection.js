'use strict';

var Promise = require("bluebird");
var Utils = require("cyclon.p2p").Utils;

var ICE_GATHERING_CHECK_INTERVAL_MS = 1000,
    ICE_GATHERING_TIMEOUT_MS = 5000,
    DATA_CHANNEL_OPEN_TIMEOUT = 30000;

function PeerConnection(rtcPeerConnection, asyncExecService, timingService, rtcObjectFactory, logger) {

    Utils.checkArguments(arguments, 5);

    var rtcDataChannel = null,
        localIceCandidates = [],
        storedIceCandidates = {},
        gatheringStartedTimeMs,
        iceGatheringMonitorId = null,
        dataChannelTimeoutId = null,
        channelOpenTimeoutId = null,
        lastOutstandingPromise = null;

    //
    // Always be listening for ICE candidates
    //
    rtcPeerConnection.onicecandidate = addLocalIceCandidate;

    //
    // Handle the case where we get a data channel before we're listening for it
    //
    rtcPeerConnection.ondatachannel = function (event) {
        rtcDataChannel = event.channel;
        logger.warn("Data channel creation was early!");
    };

    /**
     * Create an offer then do something with the local description and ICE candidates
     *
     * @returns {Promise}
     */
    this.createOffer = function () {

        lastOutstandingPromise = new Promise(function (resolve, reject) {

            //
            // Create the data channel
            //
            rtcDataChannel = rtcPeerConnection.createDataChannel("cyclonShuffleChannel");

            //
            // Create an offer, wait for ICE candidates
            //
            rtcPeerConnection.createOffer(function (localDescription) {
                rtcPeerConnection.setLocalDescription(localDescription);
                resolve();
            }, reject, {
                mandatory: {
                    OfferToReceiveAudio: false,     // see https://code.google.com/p/webrtc/issues/detail?id=2108
                    OfferToReceiveVideo: false
                }
            });
        }).cancellable();

        return lastOutstandingPromise;
    };

    /**
     * Create an answer then do something with the local connection parameters (session description and ICE candidates)
     *
     * @param remoteDescription
     * @param remoteIceCandidates
     * @returns {Promise}
     */
    this.createAnswer = function (remoteDescription, remoteIceCandidates) {

        lastOutstandingPromise = new Promise(function (resolve, reject) {

            //
            // Set remote parameters
            //
            rtcPeerConnection.setRemoteDescription(rtcObjectFactory.createRTCSessionDescription(remoteDescription));
            remoteIceCandidates.forEach(function (iceCandidate) {
                rtcPeerConnection.addIceCandidate(rtcObjectFactory.createRTCIceCandidate(iceCandidate));
            });

            //
            // Create an answer, wait for ICE candidates
            //
            rtcPeerConnection.createAnswer(function (localDescription) {
                rtcPeerConnection.setLocalDescription(localDescription);
                resolve();
            }, reject, {
                mandatory: {
                    OfferToReceiveAudio: false,     // see https://code.google.com/p/webrtc/issues/detail?id=2108
                    OfferToReceiveVideo: false
                }
            });
        }).cancellable();

        return lastOutstandingPromise;
    };

    /**
     * Wait for the data channel to appear on the peerConnection
     *
     * @returns {Promise}
     */
    this.waitForChannelEstablishment = function () {

        lastOutstandingPromise = new Promise(function (resolve, reject) {
            if (rtcDataChannel !== null) {
                resolve(rtcDataChannel);
            }
            else {
                dataChannelTimeoutId = asyncExecService.setTimeout(function () {
                    rtcPeerConnection.ondatachannel = null;
                    reject(new Promise.TimeoutError("Data channel establishment timeout exceeded"));
                }, DATA_CHANNEL_OPEN_TIMEOUT);

                rtcPeerConnection.ondatachannel = function (event) {
                    asyncExecService.clearTimeout(dataChannelTimeoutId);
                    rtcPeerConnection.ondatachannel = null;
                    rtcDataChannel = event.channel;
                    resolve(rtcDataChannel);
                };
            }
        }).cancellable()
            .catch(Promise.CancellationError, function (e) {
                asyncExecService.clearTimeout(dataChannelTimeoutId);
                rtcPeerConnection.ondatachannel = null;
                throw e;
            });

        return lastOutstandingPromise;
    };

    /**
     * Wait for an open channel then do something with it
     *
     * @returns {Promise}
     */
    this.waitForChannelToOpen = function () {

        lastOutstandingPromise = new Promise(function (resolve, reject) {

            if (rtcDataChannel.readyState === "open") {
                resolve(rtcDataChannel);
            }
            else if (typeof(rtcDataChannel.readyState) === "undefined" || rtcDataChannel.readyState === "connecting") {
                channelOpenTimeoutId = asyncExecService.setTimeout(function () {
                    rtcDataChannel.onopen = null;
                    reject(new Promise.TimeoutError("Channel opening timeout exceeded"));
                }, DATA_CHANNEL_OPEN_TIMEOUT);

                rtcDataChannel.onopen = function () {
                    asyncExecService.clearTimeout(channelOpenTimeoutId);
                    rtcDataChannel.onopen = null;
                    resolve(rtcDataChannel);
                };
            }
            else {
                throw new Error("Data channel was in illegal state: " + rtcDataChannel.readyState);
            }
        }).cancellable().catch(Promise.CancellationError, function (e) {
                asyncExecService.clearTimeout(channelOpenTimeoutId);
                rtcDataChannel.onopen = null;
                throw e;
            });

        return lastOutstandingPromise;
    };

    /**
     * Handle the answer received then do something on the
     * data channel once it opens
     *
     * @returns {Promise}
     */
    this.handleAnswer = function (answerMessage) {

        var remoteDescription = answerMessage.sessionDescription;
        var remoteIceCandidates = answerMessage.iceCandidates;

        lastOutstandingPromise = new Promise(function (resolve) {

            rtcPeerConnection.setRemoteDescription(rtcObjectFactory.createRTCSessionDescription(remoteDescription));
            remoteIceCandidates.forEach(function (candidate) {
                rtcPeerConnection.addIceCandidate(rtcObjectFactory.createRTCIceCandidate(candidate));
            });
            resolve();
        }).cancellable();

        return lastOutstandingPromise;
    };

    /**
     * Wait for ice candidates then do something with the local connection
     * parameters {sessionDescription, iceCandidates}
     *
     * @returns {Promise}
     */
    this.waitForIceCandidates = function () {

        lastOutstandingPromise = new Promise(function (resolve) {
            gatheringStartedTimeMs = timingService.getCurrentTimeInMilliseconds();
            iceGatheringMonitorId =
                asyncExecService.setInterval(function () {
                    if (iceCandidateGatheringIsComplete() || iceCandidateTimeoutIsExpired()) {
                        asyncExecService.clearInterval(iceGatheringMonitorId);
                        rtcPeerConnection.onicecandidate = null;
                        resolve({
                            sessionDescription: rtcPeerConnection.localDescription,
                            iceCandidates: localIceCandidates
                        });
                    }
                }, ICE_GATHERING_CHECK_INTERVAL_MS);
        }).cancellable()
            .catch(Promise.CancellationError, function (e) {
                asyncExecService.clearInterval(iceGatheringMonitorId);
                rtcPeerConnection.onicecandidate = null;
                throw e;
            });

        return lastOutstandingPromise;
    };

    this.getLocalIceCandidates = function() {
        return localIceCandidates;
    };

    this.getLocalDescription = function() {
        return rtcPeerConnection.localDescription;
    };

    /**
     * Cancel the last outstanding promise (if there is one)
     */
    this.cancel = function () {
        if (lastOutstandingPromise !== null && lastOutstandingPromise.isPending()) {
            lastOutstandingPromise.cancel();
        }
    };

    /**
     * Close the data channel & connection
     */
    this.close = function () {
        asyncExecService.clearTimeout(dataChannelTimeoutId);
        dataChannelTimeoutId = null;

        asyncExecService.clearTimeout(channelOpenTimeoutId);
        channelOpenTimeoutId = null;

        asyncExecService.clearInterval(iceGatheringMonitorId);
        iceGatheringMonitorId = null;

        if (rtcPeerConnection !== null) {
            rtcPeerConnection.ondatachannel = null;
            rtcPeerConnection.onicecandidate = null;
            if (rtcDataChannel !== null) {
                rtcDataChannel.onopen = null;
                rtcDataChannel.onmessage = null;
                rtcDataChannel.onerror = null;
                rtcDataChannel.onclose = null;
                rtcDataChannel.close();
                rtcDataChannel = null;
            }
            rtcPeerConnection.close();
            rtcPeerConnection = null;
        }

        localIceCandidates = null;
        storedIceCandidates = null;
        lastOutstandingPromise = null;

        iceCandidateGatheringIsComplete = null;
        iceCandidateTimeoutIsExpired = null;
        addLocalIceCandidate = null;
    };

    /**
     * Is the ICE candidate gathering process complete?
     *
     * @returns {boolean}
     */
    function iceCandidateGatheringIsComplete() {
        return rtcPeerConnection.iceGatheringState === "complete";
    }

    /**
     * Is the ICE candidate gathering timeout expired?
     *
     * @returns {boolean}
     */
    function iceCandidateTimeoutIsExpired() {
        var currentTime = timingService.getCurrentTimeInMilliseconds();
        var timeoutExpired = currentTime - gatheringStartedTimeMs > ICE_GATHERING_TIMEOUT_MS;
        if (timeoutExpired) {
            logger.warn("ICE gathering timeout exceeded");
        }
        return timeoutExpired;
    }

    /**
     * An ICE candidate was received
     *
     * @param event
     */
    function addLocalIceCandidate(event) {
        if (event.candidate) {
            // Add the ICE candidate only if we haven't already seen it
            var serializedCandidate = JSON.stringify(event.candidate);
            if(!storedIceCandidates.hasOwnProperty(serializedCandidate)) {
                storedIceCandidates[serializedCandidate] = true;
                localIceCandidates.push(event.candidate);
            }
        }
    }
}

module.exports = PeerConnection;