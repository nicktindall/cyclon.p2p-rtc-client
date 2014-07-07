'use strict';

var ClientMocks = require("./ClientMocks");
var Channel = require("../lib/Channel");
var Promise = require("bluebird");

describe("The Channel", function() {
	
	var REMOTE_PEER = {},
		CORRELATION_ID = 12345,
		REMOTE_DESCRIPTION = "remoteSDP",
		REMOTE_ICE_CANDIDATES = ['a', 'b', 'c'],
		LOCAL_DESCRIPTION = "localSDP",
		LOCAL_ICE_CANDIDATES = ['d', 'e', 'f'],
		CHANNEL_TYPE = "CHANNEL_TYPE",
		MESSAGE_TYPE = "MESSAGE_TYPE",
		MESSAGE_PAYLOAD = "MESSAGE_PAYLOAD",
		MESSAGE = {
			type: MESSAGE_TYPE,
			payload: MESSAGE_PAYLOAD
		};

	var successCallback,
		failureCallback,
		asyncExecService,
		peerConnection,
		signallingService,
		logger,
		channel;

	beforeEach(function() {
		successCallback = ClientMocks.createSuccessCallback();
		failureCallback = ClientMocks.createFailureCallback();
		asyncExecService = ClientMocks.mockAsyncExecService();
		peerConnection = ClientMocks.mockPeerConnection();
		signallingService = ClientMocks.mockSignallingService();
		logger = ClientMocks.mockLoggingService();
		channel = new Channel(asyncExecService, REMOTE_PEER, CORRELATION_ID, peerConnection, signallingService, logger);
	
		peerConnection.getLocalDescription.andReturn(LOCAL_DESCRIPTION);
		peerConnection.getLocalIceCandidates.andReturn(LOCAL_ICE_CANDIDATES);	
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
			peerConnection.createOffer.andReturn(createOfferResult);
		});

		it('delegates to the peer connection', function() {
			expect(channel.createOffer(CHANNEL_TYPE)).toBe(createOfferResult);
			expect(peerConnection.createOffer).toHaveBeenCalledWith();
		});
	});

	describe('when creating an answer', function() {

		var createAnswerResult;

		beforeEach(function() {
			createAnswerResult = "CREATE_ANSWER_RESULT";
			peerConnection.createAnswer.andReturn(createAnswerResult);
		});

		it('delegates to the peer connection', function() {
			expect(channel.createAnswer(REMOTE_DESCRIPTION, REMOTE_ICE_CANDIDATES)).toBe(createAnswerResult);
			expect(peerConnection.createAnswer).toHaveBeenCalledWith(REMOTE_DESCRIPTION, REMOTE_ICE_CANDIDATES);
		});
	});

	describe('when sending an answer', function() {

		var sendAnswerResult;

		beforeEach(function() {
			sendAnswerResult = ClientMocks.mockPromise("SEND_ANSWER_RESULT");
			signallingService.sendAnswer.andReturn(sendAnswerResult);
		});

		it('delegates to the signalling service', function() {
			expect(channel.sendAnswer()).toBe(sendAnswerResult);
			expect(signallingService.sendAnswer).toHaveBeenCalledWith(REMOTE_PEER, CORRELATION_ID, LOCAL_DESCRIPTION, LOCAL_ICE_CANDIDATES);
		});

		it('sets the lastOutstandingPromise', function() {
		 	channel.sendAnswer();
		 	sendAnswerResult.isPending.andReturn(true);
		 	channel.destroy();
		 	expect(sendAnswerResult.cancel).toHaveBeenCalled();
		});
	});

	describe('when waiting for channel establishment', function() {

		var rtcDataChannel;

		beforeEach(function() {
			rtcDataChannel = ClientMocks.mockRtcDataChannel();
			peerConnection.waitForChannelEstablishment.andReturn(Promise.resolve(rtcDataChannel));
		});

		it('delegates to the peer connection', function() {
			runs(function() {
				channel.waitForChannelEstablishment().then(successCallback).catch(failureCallback);
				expect(peerConnection.waitForChannelEstablishment).toHaveBeenCalled();
			});

			waits(10);

			runs(function() {
				expect(successCallback).toHaveBeenCalled();
				expect(failureCallback).not.toHaveBeenCalled();
			})
		});

		it('stores the data channel when resolved', function() {
			runs(function() {				
				channel.waitForChannelEstablishment();
			});

			waits(10);

			runs(function() {
				channel.destroy();
				expect(rtcDataChannel.close).toHaveBeenCalled();
			});
		});
	});

	describe('when waiting for ICE candidates', function() {

		var WAIT_FOR_ICE_CANDIDATES_RESULT = "WAIT_FOR_ICE_CANDIDATES_RESULT";

		beforeEach(function() {
			peerConnection.waitForIceCandidates.andReturn(WAIT_FOR_ICE_CANDIDATES_RESULT);
		});

		it('delegates to the peer connection', function() {
			expect(channel.waitForIceCandidates()).toBe(WAIT_FOR_ICE_CANDIDATES_RESULT);
		});
	});

	describe('when sending an offer', function() {

		var sendOfferResult;

		beforeEach(function() {
			sendOfferResult = ClientMocks.mockPromise();
			signallingService.sendOffer.andReturn(sendOfferResult);
			channel.createOffer(CHANNEL_TYPE);
		});

		it('delegates to the signalling service', function() {
			expect(channel.sendOffer()).toBe(sendOfferResult);
			expect(signallingService.sendOffer).toHaveBeenCalledWith(REMOTE_PEER, CHANNEL_TYPE, LOCAL_DESCRIPTION, LOCAL_ICE_CANDIDATES);
		});

		it('stores the promise for later cancellation', function() {
			sendOfferResult.isPending.andReturn(true);
			channel.sendOffer();
			channel.destroy();
			expect(sendOfferResult.cancel).toHaveBeenCalled();
		});
	});

	describe('when waiting for an answer', function() {

		var waitForAnswerResult;

		beforeEach(function() {
			waitForAnswerResult = ClientMocks.mockPromise();
			signallingService.waitForAnswer.andReturn(waitForAnswerResult);
		});

		it('delegates to the signalling service', function() {
			expect(channel.waitForAnswer()).toBe(waitForAnswerResult);
		});

		it('stores the promise for later cancellation', function() {
			waitForAnswerResult.isPending.andReturn(true);
			channel.waitForAnswer();
			channel.destroy();
			expect(waitForAnswerResult.cancel).toHaveBeenCalled();
		});
	});

	describe('when handling an answer', function() {

		var handleAnswerResult;

		beforeEach(function() {
			handleAnswerResult = "HANDLE_ANSWER_RESULT";
			peerConnection.handleAnswer.andReturn(handleAnswerResult);
		});

		it('delegates to the peer connection', function() {
			expect(channel.handleAnswer()).toBe(handleAnswerResult);
		});
	});

	describe('when waiting for a channel to open', function() {

		var waitForChannelToOpenResult,
			rtcDataChannel;

		beforeEach(function() {
			rtcDataChannel = ClientMocks.mockRtcDataChannel();
			waitForChannelToOpenResult = Promise.resolve(rtcDataChannel);
			peerConnection.waitForChannelToOpen.andReturn(waitForChannelToOpenResult);
		});

		it('delegates to the peer connection', function() {
			channel.waitForChannelToOpen();
			expect(peerConnection.waitForChannelToOpen).toHaveBeenCalled();
		});

		it('stores the peer connection for later closure', function() {
			runs(function() {
				channel.waitForChannelToOpen();				
			});

			waits(10);

			runs(function() {
				channel.destroy();
				expect(rtcDataChannel.close).toHaveBeenCalled();
			});
		});

		it('starts listening for messages on the opened channel', function() {
			runs(function() {
				channel.waitForChannelToOpen();				
			});

			waits(10);

			runs(function() {
				expect(rtcDataChannel.onmessage).toEqual(jasmine.any(Function));
			});			
		});
	});

	describe('when sending a message', function() {

		it('throws an error if the channel is not yet established', function() {
			expect(function() {
				channel.send(MESSAGE_TYPE, "This won't work");
			}).toThrow();
		});

		describe('and the channel has been established', function() {
			var rtcDataChannel;

			beforeEach(function() {
				runs(function() {
					rtcDataChannel = ClientMocks.mockRtcDataChannel();
					peerConnection.waitForChannelToOpen.andReturn(Promise.resolve(rtcDataChannel));
					channel.waitForChannelToOpen();
				});

				waits(10);
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

		var RECEIVE_TIMEOUT_MS = 5011;

		it('will reject with failure if the channel is not established', function() {
			
			runs(function() {
				channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
					.then(successCallback)
					.catch(failureCallback);
				});

			waits(10);

			runs(function() {
				expect(successCallback).not.toHaveBeenCalled();
				expect(failureCallback).toHaveBeenCalled();
			});
		});

		describe("And the channel is established", function() {

			var rtcDataChannel;

			beforeEach(function() {
				runs(function() {
					rtcDataChannel = ClientMocks.mockRtcDataChannel();
					peerConnection.waitForChannelToOpen.andReturn(Promise.resolve(rtcDataChannel));
					channel.waitForChannelToOpen();
				});

				waits(10);
			});

			it('will reject with failure if the readyState is anything other than "open"', function() {
				rtcDataChannel.readyState = "something other than 'open'";

				runs(function() {
					channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
						.then(successCallback)
						.catch(failureCallback);
					});

				waits(10);

				runs(function() {
					expect(successCallback).not.toHaveBeenCalled();
					expect(failureCallback).toHaveBeenCalled();
				});
			});

			describe('and the channel is in the open state', function() {

				beforeEach(function() {
					rtcDataChannel.readyState = "open";
				});

				it('will resolve with the message if it is received before the timeout', function() {
					runs(function() {
						channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
							.then(successCallback)
							.catch(failureCallback);

						rtcDataChannel.onmessage({
							data: JSON.stringify(MESSAGE)
						});
					});

					waits(10);

					runs(function() {
						expect(successCallback).toHaveBeenCalledWith(MESSAGE_PAYLOAD);
					});
				});

				it('will reject with a timeout error if the timeout expires before the message is received', function() {
					asyncExecService.setTimeout.andCallFake(function(callback) {
						setTimeout(callback, 1);
					});

					runs(function() {
						channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
							.then(successCallback)
							.catch(failureCallback);
						});
					waits(10);

					// The message arrives after the timeout
					runs(function() {
						rtcDataChannel.onmessage({
							data: JSON.stringify(MESSAGE)
						});
					});
					waits(10);

					runs(function() {
						expect(successCallback).not.toHaveBeenCalled();
						expect(failureCallback).toHaveBeenCalled();
					});
				});

				it('will reject with a cancellation error if cancel is called before the message is received', function() {
					runs(function() {
						channel.receive(MESSAGE_TYPE, RECEIVE_TIMEOUT_MS)
							.then(successCallback)
							.catch(failureCallback)
							.cancel();
						});
					waits(10);
					// The message arrives after the cancel
					runs(function() {
						rtcDataChannel.onmessage({
							data: JSON.stringify(MESSAGE)
						});
					});
					waits(10);

					runs(function() {
						expect(successCallback).not.toHaveBeenCalled();
						expect(failureCallback).toHaveBeenCalled();
					});
				});
			});
		});
	});
});