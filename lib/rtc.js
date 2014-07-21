'use strict';

var Promise = require("bluebird");
var EventEmitter = require("events").EventEmitter;

function RTC (signallingService, channelFactory) {
    this.signallingService = signallingService;
    this.channelFactory = channelFactory;
    this.channelListeners = {};
}

RTC.prototype = Object.create(EventEmitter.prototype);

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
    var self = this;
    var channelType = offerMessage.channelType;
    var listener = this.channelListeners[channelType];
    var remotePointer = offerMessage.sourcePointer;
    var correlationId = offerMessage.correlationId;

    self.emit("offerReceived", channelType, offerMessage.sourcePointer);

    if(listener) {
        var channel = this.channelFactory.createChannel(remotePointer, correlationId);

        return channel.createAnswer(offerMessage.sessionDescription, offerMessage.iceCandidates)
            .then(channel.waitForIceCandidates)
            .then(channel.sendAnswer)
            .then(channel.waitForChannelEstablishment)
            .then(channel.waitForChannelToOpen)
            .then(listener)
            .catch(Promise.TimeoutError, function() {
                self.emit("incomingTimeout", channelType, offerMessage.sourcePointer);
            })
            .catch(function(e) {
                self.emit("incomingError", channelType, offerMessage.sourcePointer, e);
            })
            .finally(channel.close);
    }
    else {
        console.warn("No listener for channel type " + channelType + ", ignoring offer!");
    }
}

module.exports = RTC;
