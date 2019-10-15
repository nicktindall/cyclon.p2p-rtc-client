'use strict';

const ClientMocks = require("./ClientMocks");
const {Channel} = require("../lib/Channel");
const events = require("events");

describe("The Channel", function() {

	var REMOTE_PEER = {},
		CORRELATION_ID = 12345,
		REMOTE_DESCRIPTION = "remoteSDP",
		LOCAL_DESCRIPTION = "localSDP",
		LOCAL_ICE_CANDIDATES = [{
            candidate: 'd'
        }, {
            candidate: 'e'
        }, {
            candidate: 'f'
        }],
		CHANNEL_TYPE = "CHANNEL_TYPE",
		MESSAGE_TYPE = "MESSAGE_TYPE",
		MESSAGE_PAYLOAD = "MESSAGE_PAYLOAD",
		MESSAGE = {
			type: MESSAGE_TYPE,
			payload: MESSAGE_PAYLOAD
        },
        REMOTE_ICE_CANDIDATES = [{
            candidate: "a"
        }, {
            candidate: "b"
        }, {
            candidate: "c"
        }],
		SHORT_CHANNEL_ESTABLISHMENT_TIMEOUT = 100;

	var successCallback,
		failureCallback,
		peerConnection,
		signallingService,
		logger,
		channel,
		peerConnectionEventEmitter;

	beforeEach(function() {
		successCallback = ClientMocks.createSuccessCallback();
		failureCallback = ClientMocks.createFailureCallback();
		peerConnection = ClientMocks.mockPeerConnection();
		signallingService = ClientMocks.mockSignallingService();
		logger = ClientMocks.mockLoggingService();
		peerConnectionEventEmitter = new events.EventEmitter();

		peerConnection.getLocalDescription.and.returnValue(LOCAL_DESCRIPTION);
		peerConnection.getLocalIceCandidates.and.returnValue(LOCAL_ICE_CANDIDATES);
		peerConnection.on.and.callFake(function(eventType, handler) {
			peerConnectionEventEmitter.on(eventType, handler);
		});

		channel = new Channel(REMOTE_PEER, CORRELATION_ID, peerConnection, signallingService, logger, SHORT_CHANNEL_ESTABLISHMENT_TIMEOUT);
	});

	describe('when a channel opens on the peer connection', function() {

		let rtcDataChannel;

		beforeEach(function() {
			rtcDataChannel = ClientMocks.mockRtcDataChannel();
			peerConnectionEventEmitter.emit('channelCreated', rtcDataChannel);
		});

		it('starts listening for messages on it', function() {
			expect(rtcDataChannel.onmessage).toEqual(jasmine.any(Function));
		});
	});

	describe('when getting the remote peer', function() {

		it('returns the remote peer', function() {
			expect(channel.getRemotePeer()).toBe(REMOTE_PEER);
		});
	});

	describe('when creating an offer', function() {

		var createOfferResult;

		beforeEach(function() {
			createOfferResult = "CREATE_OFFER_RESULT";
			peerConnection.createOffer.and.returnValue(createOfferResult);
		});

		it('delegates to the peer connection', async () => {
			expect(await channel.createOffer(CHANNEL_TYPE)).toBe(createOfferResult);
			expect(peerConnection.createOffer).toHaveBeenCalledWith();
		});
	});

	describe('when creating an answer', function() {

		var createAnswerResult;

		beforeEach(function() {
			createAnswerResult = "CREATE_ANSWER_RESULT";
			peerConnection.createAnswer.and.returnValue(createAnswerResult);
		});

		it('delegates to the peer connection', async () => {
			expect(await channel.createAnswer(REMOTE_DESCRIPTION)).toBe(createAnswerResult);
			expect(peerConnection.createAnswer).toHaveBeenCalledWith(REMOTE_DESCRIPTION);
		});
	});

	describe('when sending an answer', () => {

		const RESULT = 'SEND_ANSWER_RESULT';

		beforeEach(function() {
			signallingService.sendAnswer.and.returnValue(Promise.resolve(RESULT));
		});

		it('delegates to the signalling service', async () => {
			expect(await channel.sendAnswer()).toBe(RESULT);
			expect(signallingService.sendAnswer).toHaveBeenCalledWith(REMOTE_PEER, CORRELATION_ID, LOCAL_DESCRIPTION);
		});
	});

	describe('when waiting for channel establishment', function() {

		let rtcDataChannel;

		beforeEach(function() {
			rtcDataChannel = ClientMocks.mockRtcDataChannel();
		});

		describe('and the channel is already established', function() {

			beforeEach(function() {
				peerConnectionEventEmitter.emit("channelCreated", rtcDataChannel);
			});

			it('will proceed immediately', function(done) {
				channel.waitForChannelEstablishment().then(done);
			});
		});

		describe('and the channel is not yet established', function() {

			it('will proceed when the channel is established', function(done) {
				channel.waitForChannelEstablishment().then(done);
				peerConnectionEventEmitter.emit("channelCreated", rtcDataChannel);
			});
		});

		describe('and the channel establishment timeout expires', function() {

			it('will throw a timeout exception', function(done) {
				channel.waitForChannelEstablishment().catch(done);
			});
		});
	});

	describe('when sending an offer', function() {

		beforeEach(function() {
			signallingService.sendOffer.and.returnValue(Promise.resolve());
			channel.createOffer(CHANNEL_TYPE);
		});

		it('delegates to the signalling service', async () => {
			await channel.sendOffer(LOCAL_DESCRIPTION);
			expect(signallingService.sendOffer).toHaveBeenCalledWith(REMOTE_PEER, CHANNEL_TYPE, LOCAL_DESCRIPTION);
		});
	});

	describe('when waiting for an answer', function() {

		const RESULT='WAIT_FOR_ANSWER_RESULT';

		beforeEach(function() {
			signallingService.waitForAnswer.and.returnValue(Promise.resolve(RESULT));
		});

		it('delegates to the signalling service', async () => {
			expect(await channel.waitForAnswer()).toBe(RESULT);
		});
	});

	describe('when handling an answer', function() {

		var handleAnswerResult;

		beforeEach(function() {
			handleAnswerResult = "HANDLE_ANSWER_RESULT";
			peerConnection.handleAnswer.and.returnValue(Promise.resolve(handleAnswerResult));
		});

		it('delegates to the peer connection', async () => {
			expect(await channel.handleAnswer()).toBe(handleAnswerResult);
		});
	});


    describe("when listening for remote ICE candidates", function() {

        var CANDIDATE_EVENT_ID = "candidates-"+REMOTE_PEER.id+"-"+CORRELATION_ID;

        describe("and a correlation ID has been determined", function() {

            beforeEach(function() {
                channel.startListeningForRemoteIceCandidates();
            });

            it("adds a candidates listener to the signalling service", function() {
                expect(signallingService.on).toHaveBeenCalledWith(CANDIDATE_EVENT_ID, jasmine.any(Function));
            });
        });

        describe("and remote candidates arrive", function() {

            beforeEach(function() {
                signallingService = new events.EventEmitter();
                channel = new Channel(REMOTE_PEER, CORRELATION_ID, peerConnection, signallingService, logger, SHORT_CHANNEL_ESTABLISHMENT_TIMEOUT);
                channel.startListeningForRemoteIceCandidates();
            });

            it("delegates to the PeerConnection to process candidates as they are received", function() {
                signallingService.emit(CANDIDATE_EVENT_ID, REMOTE_ICE_CANDIDATES);
                expect(peerConnection.processRemoteIceCandidates(REMOTE_ICE_CANDIDATES));
            });
        });
    });

    describe("when sending ICE candidates", function() {

        beforeEach(function() {
            channel.startSendingIceCandidates();
        });

        it("adds a listener to the PeerConnection for new ICE candidates", function() {
            expect(peerConnection.on).toHaveBeenCalledWith("iceCandidates", jasmine.any(Function));
        });

        it("tells the peerConnection to start emitting any cached candidates", function() {
            expect(peerConnection.startEmittingIceCandidates).toHaveBeenCalled();
        });

        describe("and candidates are gathered", function() {
            beforeEach(function() {
                peerConnection = new events.EventEmitter();
                peerConnection.startEmittingIceCandidates = jasmine.createSpy();
                signallingService.sendIceCandidates.and.returnValue(Promise.resolve(null));
                channel = new Channel(REMOTE_PEER, CORRELATION_ID, peerConnection, signallingService, logger, SHORT_CHANNEL_ESTABLISHMENT_TIMEOUT);
                channel.startSendingIceCandidates();
                peerConnection.emit("iceCandidates", LOCAL_ICE_CANDIDATES);
            });

            it("sends them to the remote peer via the signalling service", function() {
                expect(signallingService.sendIceCandidates).toHaveBeenCalledWith(REMOTE_PEER, CORRELATION_ID, LOCAL_ICE_CANDIDATES);
            });
        });
    });

    describe("when stopping ICE candidate sending", function() {

        beforeEach(function() {
            channel.stopSendingIceCandidates();
        });

        it("removes the iceCandidates listener from the PeerConnection", function() {
            expect(peerConnection.removeAllListeners).toHaveBeenCalledWith("iceCandidates");
        });
    });

	describe('when waiting for a channel to open', function() {

		var waitForChannelToOpenResult,
			rtcDataChannel;

		beforeEach(function() {
			rtcDataChannel = ClientMocks.mockRtcDataChannel();
			waitForChannelToOpenResult = Promise.resolve(rtcDataChannel);
			peerConnection.waitForChannelToOpen.and.returnValue(waitForChannelToOpenResult);
		});

		it('delegates to the peer connection', function() {
			channel.waitForChannelToOpen();
			expect(peerConnection.waitForChannelToOpen).toHaveBeenCalled();
		});
	});

	describe('when sending a message', function() {

		it('throws an error if the channel is not yet established', function() {
			expect(function() {
				channel.send(MESSAGE_TYPE, "This won't work");
			}).toThrow();
		});

		describe('and the channel has been established', function() {
			let rtcDataChannel;

			beforeEach(function() {
                rtcDataChannel = ClientMocks.mockRtcDataChannel();
                peerConnectionEventEmitter.emit('channelCreated', rtcDataChannel);
			});

			it('throws an error if the readyState is anything other than "open"', function() {
				rtcDataChannel.readyState = "something other than 'open'";
				expect(function() {
					channel.send(MESSAGE_TYPE, "neither will this");
				}).toThrow();
			});

			it('sends the message on the data channel if the readyState is open', function() {
				rtcDataChannel.readyState = "open";
				channel.send(MESSAGE_TYPE, MESSAGE_PAYLOAD);
				expect(rtcDataChannel.send).toHaveBeenCalledWith(JSON.stringify(MESSAGE));
			});

			it('sends an empty object as the messsage when no message payload is specified', function() {
				rtcDataChannel.readyState = "open";
				channel.send(MESSAGE_TYPE);
				expect(rtcDataChannel.send).toHaveBeenCalledWith(JSON.stringify({
					type: MESSAGE_TYPE,
					payload: {}
				}));
			});
		});
	});

	describe('when receiving a message', function() {

		var RECEIVE_TIMEOUT_MS = 100;

		it('will reject with failure if the channel is not established', function(done) {

            channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
                .catch(function() {
                    done();
                });
		});

		describe("And the channel is established", function() {

			var rtcDataChannel;

			beforeEach(function() {
                rtcDataChannel = ClientMocks.mockRtcDataChannel();
                peerConnectionEventEmitter.emit('channelCreated', rtcDataChannel);
			});

			it('will reject with failure if the readyState is anything other than "open"', function(done) {
				rtcDataChannel.readyState = "something other than 'open'";

                channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
                    .catch(function() {
                        done();
                    });
			});

			describe('and the channel is in the open state', function() {

				beforeEach(function() {
					rtcDataChannel.readyState = "open";
				});

				it('will resolve with the message if it is received before the timeout', function(done) {
                    channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
                        .then(function(result) {
                            expect(result).toBe(MESSAGE_PAYLOAD);
                            done();
                        });

                    rtcDataChannel.onmessage({
                        data: JSON.stringify(MESSAGE)
                    });
				});

				it('will reject with a timeout error if the timeout expires before the message is received', (done) => {
					channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
                        .catch(() => {
                            done();
                        });
				});

				it('will return any unhandled messages before returning new ones', function(done) {
					rtcDataChannel.onmessage({
						data: JSON.stringify(MESSAGE)
					});
					
					channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
						.then(function(result) {
                            expect(result).toBe(MESSAGE_PAYLOAD);
                            done();
                        });
				});
			});
		});
	});

	describe('when closing', function() {

		beforeEach(function() {
			channel.close();
		});

		it('calls close on the peerConnection', function() {
			expect(peerConnection.close).toHaveBeenCalled();
		});
	});
});
