'use strict';

var EventEmitter = require("events").EventEmitter;
var Promise = require("bluebird");
var url = require('url');
var Utils = require("cyclon.p2p").Utils;
var UnreachableError = require("cyclon.p2p").UnreachableError;

function SocketIOSignallingService(signallingSocket, logger, httpRequestService) {

    Utils.checkArguments(arguments, 3);

    var myself = this;
    var localNode;
    var correlationIdCounter = 0;
    var answerEmitter = new EventEmitter();

    /**
     * Initialize the signalling channel
     *
     * @param node The node
     */
    this.initialize = function (node) {
        localNode = node;
        signallingSocket.initialize(node);

        signallingSocket.on("answer", function(message) {
            logger.debug("Answer received from : "+message.sourceId+" (correlationId "+message.correlationId+")");
            answerEmitter.emit("answer-"+message.correlationId, message);
        });
        signallingSocket.on("offer", function (message) {
            logger.debug("Offer received from :" + message.sourceId +" (correlationId "+ message.correlationId +")");
            myself.emit("offer", message);
        });
    };

    /**
     * Get the signalling info for the comms pointer data
     *
     * @returns {Array}
     */
    this.getSignallingInfo = function () {
        return signallingSocket.getCurrentServerSpecs();
    };

    /**
     * Send an offer message over the signalling channel
     *
     * @param destinationNode
     * @param sessionDescription
     * @param iceCandidates
     */
    this.sendOffer = function (destinationNode, type, sessionDescription, iceCandidates) {
        logger.debug("Sending offer to " + destinationNode.id);

        var correlationId = correlationIdCounter++;

        return new Promise(function(resolve, reject) {
            postToFirstAvailableServer(destinationNode, randomiseServerOrder(destinationNode), "./api/offer", {
                channelType: type,
                sourceId: localNode.getId(),
                correlationId: correlationId,
                sourcePointer: localNode.createNewPointer(),
                destinationId: destinationNode.id,
                sessionDescription: sessionDescription,
                iceCandidates: iceCandidates
            })
            .then(function() {
                resolve(correlationId);
            })
            .catch(reject);
        });
    };

    this.waitForAnswer = function(correlationId) {
        return new Promise(function(resolve) {
            answerEmitter.once("answer-"+correlationId, function(answer) {
                resolve(answer);
            });
        })
        .cancellable()
        .catch(Promise.CancellationError, function() {
            logger.warn("Clearing wait listener for correlation ID "+correlationId);
            answerEmitter.removeAllHandlers("answer-"+correlationId);
        });  
    };

    /**
     * Send an answer message over the signalling channel
     *
     * @param destinationNode
     * @param sessionDescription
     * @param iceCandidates
     */
    this.sendAnswer = function (destinationNode, correlationId, sessionDescription, iceCandidates) {
        logger.debug("Sending answer to " + destinationNode.id);

        return postToFirstAvailableServer(destinationNode, randomiseServerOrder(destinationNode), "./api/answer", {
            sourceId: localNode.getId(),
            correlationId: correlationId,
            destinationId: destinationNode.id,
            sessionDescription: sessionDescription,
            iceCandidates: iceCandidates
        });
    };

    /**
     * Post an object to the first available signalling server
     *
     * @param destinationNode
     * @param signallingServers
     * @param path
     * @param message
     * @returns {Promise}
     */
    function postToFirstAvailableServer(destinationNode, signallingServers, path, message) {

        return new Promise(function (resolve, reject) {
            if (signallingServers.length === 0) {
                reject(new UnreachableError(createUnreachableErrorMessage(destinationNode)));
            }
            else {
                //noinspection JSCheckFunctionSignatures
                httpRequestService.post(url.resolve(signallingServers[0].signallingApiBase, path), message)
                    .then(resolve)
                    .catch(function (error) {
                        logger.warn("An error occurred sending signalling message using " + signallingServers[0].signallingApiBase + " trying next signalling server", error);
                        postToFirstAvailableServer(destinationNode, signallingServers.slice(1), path, message).then(resolve, reject);
                    });
            }
        });
    }

    function createUnreachableErrorMessage(destinationNode) {
        return "Unable to contact node " + destinationNode.id + " using signalling servers: " + JSON.stringify(destinationNode.comms.signallingServers.map(function (server) {
            return server.signallingApiBase
        }));
    }

    function randomiseServerOrder(destinationNode) {
        return shuffle(destinationNode.comms.signallingServers.slice(0));
    }
}

SocketIOSignallingService.prototype = Object.create(EventEmitter.prototype);

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
function shuffle(o) { //v1.0
    //noinspection StatementWithEmptyBodyJS
    for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x) {
    }
    return o;
}

module.exports = SocketIOSignallingService;