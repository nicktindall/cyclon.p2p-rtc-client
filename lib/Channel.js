var Promise = require("bluebird");
var Utils = require("cyclon.p2p").Utils;
var events = require("events");

function Channel(asyncExecService, remotePeer, correlationId, peerConnection, signallingService, logger) {

    Utils.checkArguments(arguments, 6);

    var channelType = null;
    var rtcDataChannel = null;
    var messages = null;
    var self = this;

    this.getRemotePeer = function() {
        return remotePeer;
    };

    this.createOffer = function (type) {
        channelType = type;
        return peerConnection.createOffer();
    };

    this.createAnswer = function (remoteDescription, remoteIceCandidates) {
        return peerConnection.createAnswer(
            remoteDescription,
            remoteIceCandidates);
    };

    this.sendAnswer = function () {
        lastOutstandingPromise = signallingService.sendAnswer(
            remotePeer, 
            correlationId, 
            peerConnection.getLocalDescription(),
            peerConnection.getLocalIceCandidates());
        return lastOutstandingPromise;
    };

    this.waitForChannelEstablishment = function () {
        return peerConnection.waitForChannelEstablishment()
            .then(function(dataChannel) {
                rtcDataChannel = dataChannel;
                return self;
            });
    };

    this.waitForIceCandidates = function () {
        return peerConnection.waitForIceCandidates();
    };

    this.sendOffer = function () {
        lastOutstandingPromise = signallingService.sendOffer(
            remotePeer,
            channelType,
            peerConnection.getLocalDescription(), 
            peerConnection.getLocalIceCandidates());
        return lastOutstandingPromise;
    };

    this.waitForAnswer = function(correlationId) {
        lastOutstandingPromise = signallingService.waitForAnswer(correlationId);
        return lastOutstandingPromise;
    }

    this.handleAnswer = function (answerMessage) {
        return peerConnection.handleAnswer(answerMessage);
    };

    this.waitForChannelToOpen = function () {
        return peerConnection.waitForChannelToOpen()
            .then(function(establishedChannel) {
                rtcDataChannel = establishedChannel;
                addMessageListener();
                return self;
            });
    };

    function addMessageListener() {
        messages = new events.EventEmitter();
        rtcDataChannel.onmessage = function (messageEvent) {
            var parsedMessage = parseMessage(messageEvent.data);
            messages.emit(parsedMessage.type, parsedMessage.payload);
        };
    }

    function parseMessage(message) {
        try {
            return JSON.parse(message);
        }
        catch (e) {
            throw new Error("Bad message received from " + remotePeer.id + " : '" + message + "'");
        }
    }

    /**
     * Send a message
     * 
     * @param message The message to send
     */
    this.send = function (type, message) {
        if (rtcDataChannel === null) {
            throw new Error("Data channel has not yet been established!");
        }
        var channelState = String(rtcDataChannel.readyState);
        if ("open" !== channelState) {
            throw new Error("Data channel must be in 'open' state to send messages (actual state: " + channelState + ")");
        }
        rtcDataChannel.send(JSON.stringify({
            type: type,
            payload: message || {}
        }));
    };

    /**
     * Wait an amount of time for a particular type of message on a data channel
     *
     * @param messageType
     * @param dataChannel
     * @param timeoutInMilliseconds
     * @param sourcePointer
     */
    this.receive = function (messageType, timeoutInMilliseconds) {
        var timeoutTimerId = null;
        var handlerFunction = null;

        lastOutstandingPromise = new Promise(function (resolve, reject) {

            if (rtcDataChannel === null || "open" !== String(rtcDataChannel.readyState)) {
                reject(new Error("Data channel must be in 'open' state to receive " + messageType + " message"));
            }

            //
            // Add the handler
            //
            handlerFunction = function (message) {
                asyncExecService.clearTimeout(timeoutTimerId);
                resolve(message);
            };
            messages.once(messageType, handlerFunction);

            //
            // Start timeout timer
            //
            timeoutTimerId = asyncExecService.setTimeout(function () {
                messages.removeListener(messageType, handlerFunction);
                reject(new Promise.TimeoutError("Timeout reached waiting for '" + messageType + "' message (from " + remotePeer.id + ")"));
            }, timeoutInMilliseconds);

        })
        .cancellable()
        .catch(Promise.CancellationError, function (e) {
            //
            // If cancel is called, remove the listener and clear the timeout timer
            //
            messages.removeListener(messageType, handlerFunction);
            asyncExecService.clearTimeout(timeoutTimerId);
            throw e;
        });

        return lastOutstandingPromise;
    };

    this.destroy = function() {
        if (lastOutstandingPromise !== null && lastOutstandingPromise.isPending()) {
            lastOutstandingPromise.cancel();
        }
        
        if (messages !== null) {
            messages.removeAllListeners();
            messages = null;
        }

        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        if (rtcDataChannel) {
            rtcDataChannel.close();
            rtcDataChannel.onmessage = null;
            // etc..
            rtcDataChannel = null;
        }

        signallingService = null;
    };
}

module.exports = Channel;