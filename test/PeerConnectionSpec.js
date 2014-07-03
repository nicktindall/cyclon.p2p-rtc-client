'use strict';

var Promise = require("bluebird");
var PeerConnection = require("../lib/PeerConnection");
var ClientMocks = require("./ClientMocks");

describe("The peer connection", function () {

    var LOCAL_DESCRIPTION = "LOCAL_DESCRIPTION";
    var REMOTE_DESCRIPTION = "REMOTE_DESCRIPTION";
    var REMOTE_ICE_CANDIDATES = ["a", "b", "c"];
    var TIMEOUT_ID = "TIMEOUT_ID";
    var INTERVAL_ID = "INTERVAL_ID";
    var CURRENT_TIME_MILLISECONDS = new Date().getTime();
    var REMOTE_DESCRIPTION_PREFIX = "RD_";
    var REMOTE_CANDIDATE_PREFIX = "RC_";

    function remoteDescriptionFor(string) {
        return REMOTE_DESCRIPTION_PREFIX + string;
    }

    function remoteCandidateFor(string) {
        return REMOTE_CANDIDATE_PREFIX + string;
    }

    var peerConnection,
        rtcPeerConnection,
        asyncExecService,
        rtcDataChannel,
        timingService,
        rtcObjectFactory,
        loggingService;

    var successCallback, failureCallback;

    beforeEach(function () {
        successCallback = ClientMocks.createSuccessCallback();
        failureCallback = ClientMocks.createFailureCallback();

        asyncExecService = ClientMocks.mockAsyncExecService();
        timingService = ClientMocks.mockTimingService();
        rtcObjectFactory = ClientMocks.mockRtcObjectFactory();
        rtcPeerConnection = ClientMocks.mockRtcPeerConnection();
        rtcDataChannel = ClientMocks.mockRtcDataChannel();
        loggingService = ClientMocks.mockLoggingService();

        //
        // Mock behaviour
        //
        rtcPeerConnection.createDataChannel.andReturn(rtcDataChannel);
        timingService.getCurrentTimeInMilliseconds.andReturn(CURRENT_TIME_MILLISECONDS);
        rtcObjectFactory.createRTCSessionDescription.andCallFake(function (sessionDescriptionString) {
            return remoteDescriptionFor(sessionDescriptionString);
        });
        rtcObjectFactory.createRTCIceCandidate.andCallFake(function (candidateString) {
            return remoteCandidateFor(candidateString);
        });
        asyncExecService.setTimeout.andReturn(TIMEOUT_ID);
        asyncExecService.setInterval.andReturn(INTERVAL_ID);

        peerConnection = new PeerConnection(rtcPeerConnection, asyncExecService, timingService, rtcObjectFactory, loggingService);
    });

    describe("when creating an offer", function () {

        it("creates a data channel", function () {
            peerConnection.createOffer().then(successCallback).catch(failureCallback);
            expect(rtcPeerConnection.createDataChannel).toHaveBeenCalledWith('cyclonShuffleChannel');
            expect(failureCallback).not.toHaveBeenCalled();
            expect(successCallback).not.toHaveBeenCalled();
        });

        describe("and offer creation fails", function () {

            beforeEach(function () {

                runs(function () {
                    rtcPeerConnection.createOffer.andCallFake(function (success, failure) {
                        failure();
                    });
                    peerConnection.createOffer().then(successCallback).catch(failureCallback);
                });

                waits(10);
            });

            it("calls reject", function () {
                runs(function () {
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalled();
                });
            });
        });

        describe("and offer creation succeeds", function () {

            beforeEach(function () {
                runs(function () {
                    rtcPeerConnection.createOffer.andCallFake(function (successCallback) {
                        successCallback(LOCAL_DESCRIPTION);
                    });
                    peerConnection.createOffer().then(successCallback).catch(failureCallback);
                });

                waits(10);
            });

            it("sets the local description", function () {
                runs(function () {
                    expect(rtcPeerConnection.setLocalDescription).toHaveBeenCalledWith(LOCAL_DESCRIPTION);
                    expect(successCallback).toHaveBeenCalled();
                    expect(failureCallback).not.toHaveBeenCalled();
                });
            });
        });

        describe("and cancel is called before it completes", function () {

            it("rejects with a cancellation error", function () {

                runs(function () {
                    peerConnection.createOffer().then(successCallback).catch(failureCallback).cancel();
                });

                waits(100);

                runs(function () {
                    expect(rtcPeerConnection.createDataChannel).toHaveBeenCalledWith('cyclonShuffleChannel');
                    expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.CancellationError));
                    expect(successCallback).not.toHaveBeenCalled();
                });
            });
        });
    });

    describe("when gathering ICE candidates", function () {

        it("will filter duplicate candidates produced", function() {
            var firstIceCandidate = "123";
            var secondIceCandidate = "456";
            var thirdIceCandidate = "123";

            runs(function() {
                asyncExecService.setInterval.andCallFake(function (callback) {
                    rtcPeerConnection.onicecandidate({
                        candidate: firstIceCandidate
                    });
                    rtcPeerConnection.onicecandidate({
                        candidate: secondIceCandidate
                    });
                    rtcPeerConnection.onicecandidate({
                        candidate: thirdIceCandidate
                    });
                    rtcPeerConnection.localDescription = LOCAL_DESCRIPTION;
                    rtcPeerConnection.iceGatheringState = "complete";
                    setTimeout(callback, 10);
                    return INTERVAL_ID;
                
                });

                peerConnection.waitForIceCandidates().then(successCallback).catch(failureCallback);
            });

            waits(100);

            runs(function() {
                expect(successCallback).toHaveBeenCalledWith({sessionDescription: LOCAL_DESCRIPTION, iceCandidates: [firstIceCandidate, secondIceCandidate]});
            });
        });

        describe("when completed by state being 'complete'", function() {

            var firstIceCandidate = "123";
            var secondIceCandidate = "456";
            var thirdIceCandidate = "789";

            beforeEach(function() {
                asyncExecService.setInterval.andCallFake(function (callback) {
                    rtcPeerConnection.onicecandidate({
                        candidate: firstIceCandidate
                    });
                    rtcPeerConnection.onicecandidate({
                        candidate: secondIceCandidate
                    });
                    rtcPeerConnection.onicecandidate({
                        candidate: thirdIceCandidate
                    });
                    rtcPeerConnection.localDescription = LOCAL_DESCRIPTION;
                    rtcPeerConnection.iceGatheringState = "complete";
                    setTimeout(callback, 10);
                    return INTERVAL_ID;
                });

                runs(function () {
                    peerConnection.waitForIceCandidates().then(successCallback).catch(failureCallback);
                });

                waits(100);
            });

            it("clears the complete checking interval", function() {
                expect(asyncExecService.clearInterval).toHaveBeenCalledWith(INTERVAL_ID);
            });

            it("removes the onicecandidates listener", function() {
                expect(rtcPeerConnection.onicecandidate).toBeNull();
            });

            it("resolves with the gathered candidates", function() {
                expect(successCallback).toHaveBeenCalledWith({sessionDescription: LOCAL_DESCRIPTION, iceCandidates: [firstIceCandidate, secondIceCandidate, thirdIceCandidate]});
                expect(failureCallback).not.toHaveBeenCalled();
            });
        });

        describe("when completed by timeout", function () {
            var firstIceCandidate = "123";
            var secondIceCandidate = "456";
            var thirdIceCandidate = "789";

            beforeEach(function() {
                asyncExecService.setInterval.andCallFake(function (callback) {
                    rtcPeerConnection.onicecandidate({
                        candidate: firstIceCandidate
                    });
                    rtcPeerConnection.onicecandidate({
                        candidate: secondIceCandidate
                    });
                    rtcPeerConnection.onicecandidate({
                        candidate: thirdIceCandidate
                    });
                    rtcPeerConnection.localDescription = LOCAL_DESCRIPTION;
                    timingService.getCurrentTimeInMilliseconds.andReturn(CURRENT_TIME_MILLISECONDS + 8000);
                    setTimeout(callback, 10);
                    return INTERVAL_ID;
                });

                runs(function () {
                    peerConnection.waitForIceCandidates().then(successCallback).catch(failureCallback);
                });

                waits(100);
            });

            it("clears the complete checking interval", function() {
                expect(asyncExecService.clearInterval).toHaveBeenCalledWith(INTERVAL_ID);
            });

            it("removes the onicecandidates listener", function() {
                expect(rtcPeerConnection.onicecandidate).toBeNull();
            });

            it("resolves with the gathered candidates", function() {
                expect(successCallback).toHaveBeenCalledWith({sessionDescription: LOCAL_DESCRIPTION, iceCandidates: [firstIceCandidate, secondIceCandidate, thirdIceCandidate]});
                expect(failureCallback).not.toHaveBeenCalled();
            });
        });

        describe("when cancelled", function() {

            beforeEach(function() {
                runs(function () {
                    peerConnection.waitForIceCandidates().then(successCallback).catch(failureCallback).cancel();
                });

                waits(100);
            });

            it("will clear the checking interval", function() {
                expect(asyncExecService.clearInterval).toHaveBeenCalledWith(INTERVAL_ID);
            });

            it("will remove the onicecandidates listener", function() {
                expect(rtcPeerConnection.onicecandidate).toBeNull();
            });

            it("will reject with a cancellation error", function() {
                expect(successCallback).not.toHaveBeenCalled();
                expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.CancellationError));
            });
        });
    });

    describe("when creating an answer", function () {

        it("will set the remote description and add the remote ICE candidates", function () {
            runs(function () {
                peerConnection.createAnswer(REMOTE_DESCRIPTION, REMOTE_ICE_CANDIDATES).then(successCallback).catch(failureCallback);
            });

            waits(10);

            runs(function () {
                expect(rtcPeerConnection.setRemoteDescription).toHaveBeenCalledWith(remoteDescriptionFor(REMOTE_DESCRIPTION));
                expect(rtcPeerConnection.addIceCandidate).toHaveBeenCalledWith(remoteCandidateFor(REMOTE_ICE_CANDIDATES[0]));
                expect(rtcPeerConnection.addIceCandidate).toHaveBeenCalledWith(remoteCandidateFor(REMOTE_ICE_CANDIDATES[1]));
                expect(rtcPeerConnection.addIceCandidate).toHaveBeenCalledWith(remoteCandidateFor(REMOTE_ICE_CANDIDATES[2]));
                expect(successCallback).not.toHaveBeenCalled();
                expect(failureCallback).not.toHaveBeenCalled();
            });
        });

        describe("and answer creation succeeds", function () {

            beforeEach(function () {
                runs(function () {
                    rtcPeerConnection.createAnswer.andCallFake(function (successCallback) {
                        successCallback(LOCAL_DESCRIPTION);
                    });

                    peerConnection.createAnswer(REMOTE_DESCRIPTION, REMOTE_ICE_CANDIDATES).then(successCallback).catch(failureCallback);
                });

                waits(10);
            });

            it("sets the local description", function () {
                runs(function () {
                    expect(rtcPeerConnection.setLocalDescription).toHaveBeenCalledWith(LOCAL_DESCRIPTION);
                    expect(successCallback).toHaveBeenCalled();
                    expect(failureCallback).not.toHaveBeenCalled();
                });
            });
        });

        describe("and answer creation fails", function () {

            beforeEach(function () {
                runs(function () {
                    rtcPeerConnection.createAnswer.andCallFake(function (success, failure) {
                        failure();
                    });

                    peerConnection.createAnswer(REMOTE_DESCRIPTION, REMOTE_ICE_CANDIDATES).then(successCallback).catch(failureCallback);
                });

                waits(10);
            });

            it("doesn't set the local description and rejects", function () {
                runs(function () {
                    expect(rtcPeerConnection.setLocalDescription).not.toHaveBeenCalled();
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalled();
                });
            });
        });

        describe("and cancel is called while it's in progress", function () {

            beforeEach(function () {
                runs(function () {
                    peerConnection.createAnswer(REMOTE_DESCRIPTION, REMOTE_ICE_CANDIDATES).then(successCallback).catch(failureCallback).cancel();
                });

                waits(100);
            });

            it("doesn't set the local description and rejects with a cancellation error", function () {
                runs(function () {
                    expect(rtcPeerConnection.setLocalDescription).not.toHaveBeenCalled();
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.CancellationError));
                });
            });
        });
    });

    describe("when waiting for an open channel", function () {

        beforeEach(function () {
            rtcPeerConnection.createOffer.andCallFake(function (success) {
                success();
            });

            peerConnection.createOffer().then(function () {
            });
        });

        waits(10);

        describe("and the channel is already opened", function () {

            beforeEach(function () {
                rtcDataChannel.readyState = "open";
            });

            it("resolves the already opened channel", function () {

                runs(function () {
                    peerConnection.waitForChannelToOpen().then(successCallback).catch(failureCallback);
                });

                waits(10);

                runs(function () {
                    expect(successCallback).toHaveBeenCalledWith(rtcDataChannel);
                    expect(failureCallback).not.toHaveBeenCalled();
                });
            });
        });

        describe("and the channel is not already opened", function () {

            describe("and the channel opens successfully", function () {

                it("clears the timeout and passes an open channel to resolve", function () {

                    runs(function () {
                        peerConnection.waitForChannelToOpen().then(successCallback).catch(failureCallback);
                    });

                    waits(10);

                    runs(function () {
                        rtcDataChannel.onopen();
                    });

                    waits(10);

                    runs(function () {
                        expect(asyncExecService.clearTimeout).toHaveBeenCalledWith(TIMEOUT_ID);
                        expect(successCallback).toHaveBeenCalledWith(rtcDataChannel);
                        expect(failureCallback).not.toHaveBeenCalled();
                    });
                });
            });

            describe("and a timeout occurs before the channel is opened", function () {

                beforeEach(function () {
                    runs(function () {
                        asyncExecService.setTimeout.andCallFake(function (callback) {
                            setTimeout(callback, 10);
                        });
                        peerConnection.waitForChannelToOpen().then(successCallback).catch(failureCallback);
                    });

                    waits(100);
                });

                it("clears the channel onopen listener", function () {
                    expect(rtcDataChannel.onopen).toBeNull();
                });

                it("calls reject with a timeout error", function () {
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.TimeoutError));
                });
            });

            describe("and cancel is called before the channel is opened", function () {

                beforeEach(function () {
                    runs(function () {
                        peerConnection.waitForChannelToOpen().then(successCallback).catch(failureCallback).cancel();
                    });

                    waits(100);
                });

                it("clears the timeout", function () {
                    expect(asyncExecService.clearTimeout).toHaveBeenCalledWith(TIMEOUT_ID);
                });

                it("clears the channel onopen listener", function () {
                    expect(rtcDataChannel.onopen).toBeNull();
                });

                it("calls reject with a cancellation error", function () {
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.CancellationError));
                });
            });
        });
    });

    describe("when waiting for channel establishment", function () {

        describe("and a channel has already been established", function () {

            beforeEach(function () {
                rtcPeerConnection.ondatachannel({
                    channel: rtcDataChannel
                });
            });

            it("will resolve with the already established channel", function () {
                runs(function () {
                    peerConnection.waitForChannelEstablishment().then(successCallback).catch(failureCallback);
                });

                waits(10);

                runs(function () {
                    expect(successCallback).toHaveBeenCalledWith(rtcDataChannel);
                });
            });
        });

        describe("and no channel is yet established", function () {

            var promise;

            beforeEach(function () {
                runs(function () {
                    promise = peerConnection.waitForChannelEstablishment().then(successCallback).catch(failureCallback);
                });

                waits(10);
            });

            it("sets a timeout", function () {
                expect(asyncExecService.setTimeout).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Number));
            });

            it("adds an ondatachannel listener", function () {
                expect(rtcPeerConnection.ondatachannel).toEqual(jasmine.any(Function));
            });

            it("waits for an open channel", function () {
                expect(successCallback).not.toHaveBeenCalled();
                expect(failureCallback).not.toHaveBeenCalled();
            });

            describe("and cancel is called before it is established", function () {

                beforeEach(function () {

                    runs(function () {
                        promise.cancel();
                    });

                    waits(100);
                });

                it("clears the timeout", function () {
                    expect(asyncExecService.clearTimeout).toHaveBeenCalledWith(TIMEOUT_ID);
                });

                it("nullifies the ondatachannel listener", function () {
                    expect(rtcPeerConnection.ondatachannel).toBeNull();
                });

                it("rejects with a cancellation error", function () {
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.CancellationError));
                });
            });

            describe("and a channel is established before the timeout", function () {

                beforeEach(function () {

                    runs(function () {
                        rtcPeerConnection.ondatachannel({
                            channel: rtcDataChannel
                        });
                    });

                    waits(10);
                });

                it("clears the timeout", function () {
                    expect(asyncExecService.clearTimeout).toHaveBeenCalledWith(TIMEOUT_ID);
                });

                it("nullifies the ondatachannel listener", function () {
                    expect(rtcPeerConnection.ondatachannel).toBeNull();
                });

                it("resolves with the established channel", function () {
                    expect(successCallback).toHaveBeenCalledWith(rtcDataChannel);
                    expect(failureCallback).not.toHaveBeenCalled();
                })
            });

            describe("and a timeout occurs before the channel is established", function () {

                beforeEach(function () {
                    runs(function () {
                        asyncExecService.setTimeout.andCallFake(function (callback) {
                            setTimeout(callback, 10);
                        });
                        peerConnection.waitForChannelEstablishment().then(successCallback).catch(failureCallback);
                    });

                    waits(100);
                });

                it("clears the channel ondatachannel listener", function () {
                    expect(rtcPeerConnection.ondatachannel).toBeNull();
                });

                it("calls reject with a timeout error", function () {
                    expect(successCallback).not.toHaveBeenCalled();
                    expect(failureCallback).toHaveBeenCalledWith(jasmine.any(Promise.TimeoutError));
                });
            });
        });
    });

    describe("when handling an answer", function () {

        beforeEach(function() {
            runs(function () {
                peerConnection.createOffer().then(function () {
                });
                peerConnection.handleAnswer({
                    sessionDescription: REMOTE_DESCRIPTION,
                    iceCandidates: REMOTE_ICE_CANDIDATES
                }).then(successCallback).catch(failureCallback);
            });

            waits(10);
        });

        it("sets the remote description and adds the ice candidates", function () {

            expect(rtcPeerConnection.setRemoteDescription).toHaveBeenCalledWith(remoteDescriptionFor(REMOTE_DESCRIPTION));

            expect(rtcPeerConnection.addIceCandidate).toHaveBeenCalledWith(remoteCandidateFor(REMOTE_ICE_CANDIDATES[0]));
            expect(rtcPeerConnection.addIceCandidate).toHaveBeenCalledWith(remoteCandidateFor(REMOTE_ICE_CANDIDATES[1]));
            expect(rtcPeerConnection.addIceCandidate).toHaveBeenCalledWith(remoteCandidateFor(REMOTE_ICE_CANDIDATES[2]));

            expect(successCallback).toHaveBeenCalled();
            expect(failureCallback).not.toHaveBeenCalled();
        });
    });

    describe("when closing", function () {

        it("calls close on and removes the listeners from the data channel and peer connection", function () {

            runs(function () {
                rtcDataChannel.onopen = "xx";
                rtcDataChannel.onclose = "xx";
                rtcDataChannel.onmessage = "xx";
                rtcDataChannel.onerror = "xx";

                peerConnection.createOffer().then(function () {
                });

                rtcPeerConnection.onicecandidate = "xx";
                rtcPeerConnection.ondatachannel = "xx";
            });

            waits(10);

            runs(function () {
                peerConnection.close();
                expect(rtcDataChannel.onopen).toBeNull();
                expect(rtcDataChannel.onmessage).toBeNull();
                expect(rtcDataChannel.onerror).toBeNull();
                expect(rtcPeerConnection.ondatachannel).toBeNull();
                expect(rtcPeerConnection.onicecandidate).toBeNull();

                expect(rtcDataChannel.close).toHaveBeenCalled();
                expect(rtcPeerConnection.close).toHaveBeenCalled();
            });
        });
    });
});