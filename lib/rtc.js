'use strict';

var Promise = require("bluebird");

function RTC (signallingService, channelFactory) {
    this.signallingService = signallingService;
    this.channelFactory = channelFactory;
    this.channelListeners = {};
}

RTC.prototype.join = function (localNode) {
    var self = this;
    this.signallingService.initialize(localNode);
    this.signallingService.on("offer", function(message) {
        self.handleOffer(message);
    });
}

RTC.prototype.getSignallingInfo = function () {
    return this.signallingService.getSignallingInfo();
}

RTC.prototype.onChannel = function (type, callback) {
    this.channelListeners[type] = callback;
}

RTC.prototype.openChannel = function (type, remotePointer) {
    var channel = this.channelFactory.createChannel(remotePointer);

    return channel.createOffer(type)
        .then(channel.waitForIceCandidates)
        .then(channel.sendOffer)
        .then(channel.waitForAnswer)
        .then(channel.handleAnswer)
        .then(channel.waitForChannelToOpen)
        .catch(function(error) {
            // If an error occurs here, cleanup our attempted channel
            // establishment resources before continuing
            channel.close();
            throw error;
        });
}

RTC.prototype.handleOffer = function (offerMessage) {
    var channelType = offerMessage.channelType;
    var listener = this.channelListeners[channelType];
    var remotePointer = offerMessage.sourcePointer;
    var correlationId = offerMessage.correlationId;

    if(listener) {
        var channel = this.channelFactory.createChannel(remotePointer, correlationId);

        return channel.createAnswer(offerMessage.sessionDescription, offerMessage.iceCandidates)
            .then(channel.waitForIceCandidates)
            .then(channel.sendAnswer)
            .then(channel.waitForChannelEstablishment)
            .then(channel.waitForChannelToOpen)
            .then(listener)
            .catch(Promise.TimeoutError, function(e) {
                console.error(e);
            })
            .finally(channel.close);
    }
    else {
        console.warn("No listener for channel type " + channelType + ", ignoring offer!");
    }
}

module.exports = RTC;
