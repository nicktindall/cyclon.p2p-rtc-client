'use strict';

var Promise = require("bluebird");
var SocketIOSignallingService = require("../lib/SocketIOSignallingService");
var ClientMocks = require("./ClientMocks");
var UnreachableError = require("cyclon.p2p").UnreachableError;

describe("The socket.io signalling service", function () {

    var signallingService,
        answerHandler,
        offerHandler,
        localCyclonNode,
        loggingService,
        signallingSocket,
        httpRequestService,
        successCallback,
        failureCallback,
        capSuccess,
        capFailure;

    var LOCAL_ID = "LOCAL_ID";
    var SIGNALLING_BASE = "http://signalling-base.com/path/to/";
    var DESTINATION_NODE = {
        id: "DESTINATION_ID",
        comms: {
            signallingServers: [{
                signallingApiBase: SIGNALLING_BASE
            }]
        }
    };
    var SESSION_DESCRIPTION = "SESSION_DESCRIPTION";
    var ICE_CANDIDATES = ["a", "b", "c"];
    var NODE_POINTER = "NODE_POINTER";
    var TYPE = "TYPE";
    var CORRELATION_ID = "CORRELATION_ID";

    beforeEach(function () {
        successCallback = ClientMocks.createSuccessCallback();
        failureCallback = ClientMocks.createFailureCallback();

        // Create mocks
        answerHandler = jasmine.createSpy('answerHandler');
        offerHandler = jasmine.createSpy('offerHandler');

        localCyclonNode = ClientMocks.mockCyclonNode();
        loggingService = ClientMocks.mockLoggingService();
        signallingSocket = ClientMocks.mockSignallingSocket();
        httpRequestService = ClientMocks.mockHttpRequestService();

        // Mock behaviour
        localCyclonNode.createNewPointer.andReturn(NODE_POINTER);
        localCyclonNode.getId.andReturn(LOCAL_ID);

        // Capture success/failure callbacks when post is called
        httpRequestService.post.andCallFake(function() {
            return Promise.resolve({});
        });
        capSuccess = capFailure = null;

        signallingService = new SocketIOSignallingService(signallingSocket, loggingService, httpRequestService);
    });

    describe("when initializing", function () {

        beforeEach(function() {
            signallingService.initialize(localCyclonNode, answerHandler, offerHandler);
        });

        it("should initialise the underlying signalling socket", function () {
            expect(signallingSocket.initialize).toHaveBeenCalledWith(localCyclonNode);
        });

        it("should add a listener to invoke the answer handler on 'answer'", function () {
            expect(signallingSocket.on).toHaveBeenCalledWith("answer", jasmine.any(Function));
        });

        it("should add a listener to invoke the offerHandler on 'offer'", function () {
            expect(signallingSocket.on).toHaveBeenCalledWith("offer", jasmine.any(Function));
        });
    });

    describe("when sending messages", function () {

        beforeEach(function () {
            signallingService.initialize(localCyclonNode, answerHandler, offerHandler);
        });

        it("should emit a correctly structured offer message", function () {

            runs(function() {
                signallingService.sendOffer(DESTINATION_NODE, TYPE, SESSION_DESCRIPTION, ICE_CANDIDATES).then(successCallback).catch(failureCallback);
            });

            waits(10);

            runs(function() {
                expect(httpRequestService.post).toHaveBeenCalledWith(SIGNALLING_BASE + "api/offer", {
                    type: TYPE,
                    sourceId: LOCAL_ID,
                    correlationId: 0,
                    sourcePointer: NODE_POINTER,
                    destinationId: DESTINATION_NODE.id,
                    sessionDescription: SESSION_DESCRIPTION,
                    iceCandidates: ICE_CANDIDATES
                });

                expect(successCallback).toHaveBeenCalled();
                expect(failureCallback).not.toHaveBeenCalled();
            });
        });

        it("should emit a correctly structured answer message", function () {

            runs(function() {
                signallingService.sendAnswer(DESTINATION_NODE, CORRELATION_ID, SESSION_DESCRIPTION, ICE_CANDIDATES).then(successCallback).catch(failureCallback);
            });

            waits(10);

            runs(function() {
                expect(httpRequestService.post).toHaveBeenCalledWith(SIGNALLING_BASE + "api/answer", {
                    sourceId: LOCAL_ID,
                    correlationId: CORRELATION_ID,
                    destinationId: DESTINATION_NODE.id,
                    sessionDescription: SESSION_DESCRIPTION,
                    iceCandidates: ICE_CANDIDATES
                });

                expect(successCallback).toHaveBeenCalled();
                expect(failureCallback).not.toHaveBeenCalled();
            });
        });

        it("should throw an UnreachableError when the peer has no signalling servers specified", function() {

            var errorIsInstanceOfUnreachableError = false;
            var destinationNodeWithNoSignallingServers = {
                id: "DESTINATION_ID",
                comms: {
                    signallingServers: []
                }
            };

            runs(function() {
                signallingService.sendAnswer(destinationNodeWithNoSignallingServers, SESSION_DESCRIPTION, ICE_CANDIDATES)
                    .then(successCallback)
                    .catch(function(error) {
                        errorIsInstanceOfUnreachableError = error instanceof UnreachableError;
                    });
            });

            waits(10);

            runs(function() {
                expect(errorIsInstanceOfUnreachableError).toBeTruthy();
                expect(successCallback).not.toHaveBeenCalled();
            })
        });

        it("should throw an UnreachableError when the peer is no longer connected to any of its signalling servers", function() {

            httpRequestService.post.andReturn(Promise.reject(new Error("404 received")));
            var errorIsInstanceOfUnreachableError = false;

            runs(function() {
                signallingService.sendAnswer(DESTINATION_NODE, SESSION_DESCRIPTION, ICE_CANDIDATES)
                    .then(successCallback)
                    .catch(function(error) {
                        errorIsInstanceOfUnreachableError = error instanceof UnreachableError;
                    });
            });

            waits(10);

            runs(function() {
                expect(errorIsInstanceOfUnreachableError).toBeTruthy();
                expect(successCallback).not.toHaveBeenCalled();
            })
        });
    });
});