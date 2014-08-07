"use strict";

module.exports.mockLoggingService = function () {
    return require("cyclon.p2p-common").consoleLogger();
};

module.exports.mockSignallingService = function () {
    return jasmine.createSpyObj('signallingService', ['connect', 'getSignallingInfo', 'sendOffer', 'sendAnswer', 'on', 'removeListener', 'waitForAnswer', 'removeAllListeners', 'createNewPointer']);
};

module.exports.mockAsyncExecService = function () {
    return jasmine.createSpyObj('asyncExecService', ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval']);
};

module.exports.mockPeerConnection = function (name) {
    return jasmine.createSpyObj(name || 'peerConnection', ['createOffer', 'createAnswer', 'waitForChannelEstablishment', 'waitForChannelToOpen', 'handleAnswer', 'close', 'waitForIceCandidates', 'cancel', 'getLocalDescription', 'getLocalIceCandidates', 'removeAllListeners']);
};

module.exports.mockTimingService = function () {
    return jasmine.createSpyObj('timingService', ['getCurrentTimeInMilliseconds']);
};

module.exports.mockRtcObjectFactory = function () {
    return jasmine.createSpyObj('rtcObjectFactory', ['createRTCSessionDescription', 'createRTCIceCandidate']);
};

module.exports.mockSignallingSocket = function () {
    return jasmine.createSpyObj('signallingSocket', ['getCurrentServerSpecs', 'connect', 'on']);
};

module.exports.mockSocketFactory = function() {
    return jasmine.createSpyObj('mockSocketFactory', ['createSocket']);
};

module.exports.mockHttpRequestService = function () {
    return jasmine.createSpyObj('httpRequestService', ['get', 'post']);
};

module.exports.mockPeerConnectionFactory = function () {
    return jasmine.createSpyObj('peerConnectionFactory', ['createPeerConnection']);
};

module.exports.mockNeighbourSet = function () {
    return jasmine.createSpyObj('neighbourSet', ['contains', 'insert', 'remove', 'get', 'size', 'selectShuffleSet', 'findOldestId', 'randomSelection', 'incrementAges', 'resetAge', 'mergeNodePointerIfNewer']);
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




