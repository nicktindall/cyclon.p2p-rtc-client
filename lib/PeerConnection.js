'use strict';

var Promise = require("bluebird");
var Utils = require("cyclon.p2p-common");
var EventEmitter = require("events").EventEmitter;

var DATA_CHANNEL_OPEN_TIMEOUT = 30000;

function PeerConnection (rtcPeerConnection, asyncExecService, rtcObjectFactory, logger) {

    Utils.checkArguments(arguments, 4);

    var rtcDataChannel = null,
        localIceCandidates = [],
        localDescription = null,
        storedIceCandidates = {},
        dataChannelTimeoutId = null,
        channelOpenTimeoutId = null,
        lastOutstandingPromise = null,
        emittingIceCandidates = false,
        remoteDescription = null,
        remoteDescriptionSet = false,
        remoteIceCandidateCache = [],
        self = this;

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
            rtcPeerConnection.createOffer(function (sdp) {
                localDescription = sdp;
                rtcPeerConnection.setLocalDescription(localDescription);
                resolve(localDescription);
            }, reject, {
                mandatory: {
                    OfferToReceiveAudio: false,     // see https://code.google.com/p/webrtc/issues/detail?id=2108
                    OfferToReceiveVideo: false
                }
            });
        })
        .cancellable();

        return lastOutstandingPromise;
    };

    /**
     * Create an answer then do something with the local connection parameters (session description and ICE candidates)
     *
     * @param remoteDescription
     * @param remoteIceCandidates
     * @returns {Promise}
     */
    this.createAnswer = function (remoteDescription) {

        lastOutstandingPromise = new Promise(function (resolve, reject) {

            rtcPeerConnection.setRemoteDescription(rtcObjectFactory.createRTCSessionDescription(remoteDescription));

            // Process any ICE candidates that arrived before the description was set
            remoteDescriptionSet = true;
            self.processRemoteIceCandidates([]);

            rtcPeerConnection.createAnswer(function (sdp) {
                localDescription = sdp;
                rtcPeerConnection.setLocalDescription(localDescription);
                resolve();
            }, reject, {
                mandatory: {
                    OfferToReceiveAudio: false,     // see https://code.google.com/p/webrtc/issues/detail?id=2108
                    OfferToReceiveVideo: false
                }
            });
        })
        .cancellable();

        return lastOutstandingPromise;
    };

    /**
     * Process some remote ICE candidates
     */
    this.processRemoteIceCandidates = function (remoteIceCandidates) {
        remoteIceCandidateCache = remoteIceCandidateCache.concat(remoteIceCandidates);
        if(remoteDescriptionSet) {
            remoteIceCandidateCache.forEach(function (iceCandidate) {
                logger.debug("Adding remote ICE candidate: " + iceCandidate.candidate);
                rtcPeerConnection.addIceCandidate(rtcObjectFactory.createRTCIceCandidate(iceCandidate));
            });
            remoteIceCandidateCache = [];
        }
    };

    /**
     * Start emitting gathered ICE candidates as events
     */
    this.startEmittingIceCandidates = function () {
        emittingIceCandidates = true;
        asyncExecService.setTimeout(function() {
            addLocalIceCandidate(null);
        }, 10);
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
        })
        .cancellable()
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
        })
        .cancellable()
        .catch(Promise.CancellationError, function (e) {
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
        rtcPeerConnection.setRemoteDescription(rtcObjectFactory.createRTCSessionDescription(remoteDescription));
        remoteDescriptionSet = true;
        self.processRemoteIceCandidates([]);
    };

    this.getLocalIceCandidates = function() {
        return localIceCandidates;
    };

    this.getLocalDescription = function() {
        if(!localDescription) {
            throw new Error("Local description is not yet set!");
        }
        return localDescription;
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
        remoteDescription = null;

        addLocalIceCandidate = null;
    };

    /**
     * An ICE candidate was received
     *
     * @param event
     */
    function addLocalIceCandidate(event) {
        if (event && event.candidate) {
            // Add the ICE candidate only if we haven't already seen it
            var serializedCandidate = JSON.stringify(event.candidate);
            if(!storedIceCandidates.hasOwnProperty(serializedCandidate)) {
                storedIceCandidates[serializedCandidate] = true;
                localIceCandidates.push(event.candidate);
            }
        }

        // Emit an iceCandidates event containing all the candidates
        // gathered since the last event if we are emitting
        if (emittingIceCandidates && localIceCandidates.length > 0) {
            self.emit("iceCandidates", localIceCandidates);
            localIceCandidates = [];
        }
    }
}

PeerConnection.prototype = Object.create(EventEmitter.prototype);

module.exports = PeerConnection;
