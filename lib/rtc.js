'use strict';

var Promise = require("bluebird");
var EventEmitter = require("events").EventEmitter;
var Utils = require("cyclon.p2p-common");

function RTC (signallingService, channelFactory) {

    Utils.checkArguments(arguments, 2);

    this.signallingService = signallingService;
    this.channelFactory = channelFactory;
    this.channelListeners = {};
}

RTC.prototype = Object.create(EventEmitter.prototype);

RTC.prototype.connect = function (metadataProviders) {
    var self = this;
    this.signallingService.connect(metadataProviders);
    this.signallingService.on("offer", function(message) {
        self.handleOffer(message);
    });
};

RTC.prototype.createNewPointer = function (metaData) {
    return this.signallingService.createNewPointer(metaData);
};

RTC.prototype.getLocalId = function () {
    return this.signallingService.getLocalId();
};

RTC.prototype.onChannel = function (type, callback) {
    this.channelListeners[type] = callback;
};

RTC.prototype.openChannel = function (type, remotePointer) {
    var channel = this.channelFactory.createChannel(remotePointer);

    return channel.createOffer(type)
        .then(channel.sendOffer)
        .then(channel.startListeningForRemoteIceCandidates)
        .then(channel.waitForAnswer)
        .then(channel.handleAnswer)
        .then(channel.startSendingIceCandidates)
        .then(channel.waitForChannelToOpen)
        .then(channel.stopSendingIceCandidates)
        .catch(function(error) {
            // If an error occurs here, cleanup our attempted channel
            // establishment resources before continuing
            channel.close();
            throw error;
        });
};

RTC.prototype.handleOffer = function (offerMessage) {
    var self = this;
    var channelType = offerMessage.channelType;
    var listener = this.channelListeners[channelType];
    var remotePointer = offerMessage.sourcePointer;
    var correlationId = offerMessage.correlationId;

    self.emit("offerReceived", channelType, offerMessage.sourcePointer);

    if (listener) {
        var channel = this.channelFactory.createChannel(remotePointer, correlationId);

        channel.createAnswer(offerMessage.sessionDescription)
            .then(channel.startListeningForRemoteIceCandidates)
            .then(channel.sendAnswer)
            .then(channel.startSendingIceCandidates)
            .then(channel.waitForChannelEstablishment)
            .then(channel.waitForChannelToOpen)
            .then(channel.stopSendingIceCandidates)
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
};

module.exports = RTC;
