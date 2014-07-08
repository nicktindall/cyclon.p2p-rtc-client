"use strict";

var ConsoleLogger = require("cyclon.p2p").ConsoleLogger;

module.exports.mockLoggingService = function () {
    return new ConsoleLogger();
};

module.exports.mockMessagingUtilities = function () {
    return jasmine.createSpyObj('messagingUtilities', ['waitForChannelMessage']);
};

module.exports.mockSignallingService = function () {
    return jasmine.createSpyObj('signallingService', ['initialize', 'getSignallingInfo', 'sendOffer', 'sendAnswer', 'on', 'removeListener', 'waitForAnswer']);
};

module.exports.mockCyclonNode = function () {
    return jasmine.createSpyObj('cyclonNode', ['getId', 'start', 'executeShuffle', 'createNewPointer', 'handleShuffleRequest', 'handleShuffleResponse', 'emit']);
};

module.exports.mockAsyncExecService = function () {
    return jasmine.createSpyObj('asyncExecService', ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval']);
};

module.exports.mockPeerConnection = function (name) {
    return jasmine.createSpyObj(name || 'peerConnection', ['createOffer', 'createAnswer', 'waitForChannelEstablishment', 'waitForChannelToOpen', 'handleAnswer', 'close', 'waitForIceCandidates', 'cancel', 'getLocalDescription', 'getLocalIceCandidates']);
};

module.exports.mockTimingService = function () {
    return jasmine.createSpyObj('timingService', ['getCurrentTimeInMilliseconds']);
};

module.exports.mockRtcObjectFactory = function () {
    return jasmine.createSpyObj('rtcObjectFactory', ['createRTCSessionDescription', 'createRTCIceCandidate']);
};

module.exports.mockSignallingSocket = function () {
    return jasmine.createSpyObj('signallingSocket', ['getCurrentServerSpecs', 'initialize', 'on']);
};

module.exports.mockSocketFactory = function() {
    return jasmine.createSpyObj('mockSocketFactory', ['createSocket']);
}

module.exports.mockHttpRequestService = function () {
    return jasmine.createSpyObj('httpRequestService', ['get', 'post']);
};

module.exports.mockPeerConnectionFactory = function () {
    return jasmine.createSpyObj('peerConnectionFactory', ['createPeerConnection']);
};

module.exports.mockShuffleStateFactory = function () {
    return jasmine.createSpyObj('shuffleStateFactory', ['createOutgoingShuffleState', 'createIncomingShuffleState']);
};

module.exports.mockOutgoingShuffleState = function (name) {
    return jasmine.createSpyObj(name || 'outgoingShuffleState', ['sendOffer', 'sendShuffleRequest', 'processShuffleResponse', 'getDestinationId', 'sendResponseAcknowledgement', 'close', 'handleAnswer', 'waitForAnswer', 'cancel']);
};

module.exports.mockIncomingShuffleState = function () {
    return jasmine.createSpyObj('incomingShuffleState', ['sendAnswer', 'processShuffleRequest', 'close', 'cancel', 'waitForResponseAcknowledgement']);
};

module.exports.mockNeighbourSet = function () {
    return jasmine.createSpyObj('neighbourSet', ['contains', 'insert', 'remove', 'get', 'size', 'selectShuffleSet', 'findOldestId', 'randomSelection', 'incrementAges', 'resetAge', 'mergeNodePointerIfNewer']);
};

module.exports.mockComms = function () {
    return jasmine.createSpyObj('comms', ['sendShuffleRequest', 'sendShuffleResponse', 'getPointerData']);
};

module.exports.mockStorage = function() {
    return jasmine.createSpyObj('storage', ['getItem', 'setItem']);
};

module.exports.mockSignallingServerService = function() {
    return jasmine.createSpyObj('signallingServerService', ['getSignallingServerSpecs', 'getPreferredNumberOfSockets'])
};

//
// WebRTC API mocks
//
module.exports.mockRtcDataChannel = function (name) {
    return jasmine.createSpyObj(name || 'rtcDataChannel', ['send', 'close']);
};

module.exports.mockRtcPeerConnection = function () {
    return jasmine.createSpyObj('rtcPeerConnection', ['createDataChannel', 'createOffer', 'setLocalDescription', 'setRemoteDescription', 'createAnswer', 'addIceCandidate', 'close']);
};

//
// Success/failure callbacks for testing
//
module.exports.createSuccessCallback = function () {
    return jasmine.createSpy('successCallback');
};

module.exports.createFailureCallback = function () {
    return jasmine.createSpy('failureCallback').andCallFake(function (error) {
        //console.error("Error occurred!", error);
    });
};

module.exports.mockPromise = function(name) {
    var mockPromise = jasmine.createSpyObj(name || 'mockPromise', ['isPending', 'close', 'cancel', 'then', 'catch', 'cancellable']);
    mockPromise.then.andReturn(mockPromise);
    mockPromise.cancellable.andReturn(mockPromise);
    mockPromise.catch.andReturn(mockPromise);
    return mockPromise;
};




