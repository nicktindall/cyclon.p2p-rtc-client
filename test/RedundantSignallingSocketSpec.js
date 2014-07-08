'use strict';

var ClientMocks = require("./ClientMocks");
var RedundantSignallingSocket = require("../lib/RedundantSignallingSocket");
var events = require("events");

describe('The RedundantSignallingSocket', function() {

	var SIGNALLING_SPEC_1 = {
			signallingApiBase: "API_BASE_1"
		},
		SIGNALLING_SPEC_2 = {
			signallingApiBase: "API_BASE_2"
		},
		SIGNALLING_SPEC_3 = {
			signallingApiBase: "API_BASE_3"
		},
		SIGNALLING_SPEC_4 = {
			signallingApiBase: "API_BASE_4"
		},
		ONE_MINUTE = 1000 * 60;

	var signallingServerService,
		socketFactory,
		loggingService,
		asyncExecService,
		redundantSignallingSocket,
		localNode,
		storage,
		connectedServerSpecs,
		connectedSockets,
		connectivityCheckCallback,
		timingService,
		currentTime;

	beforeEach(function() {
		currentTime = new Date().getTime();
		connectedServerSpecs = [];
		connectedSockets = [];
		localNode = ClientMocks.mockCyclonNode();
		signallingServerService = ClientMocks.mockSignallingServerService();
		socketFactory = ClientMocks.mockSocketFactory();
		loggingService = ClientMocks.mockLoggingService();
		asyncExecService = ClientMocks.mockAsyncExecService();
		storage = ClientMocks.mockStorage();
		timingService = ClientMocks.mockTimingService();

		redundantSignallingSocket = new RedundantSignallingSocket(signallingServerService, socketFactory, loggingService, asyncExecService, storage, timingService);
	
		socketFactory.createSocket.andCallFake(function(signallingSpec) {
			connectedServerSpecs.push(signallingSpec);
			var newSocket = new events.EventEmitter();
			newSocket.io = new events.EventEmitter();
			newSocket.disconnect = jasmine.createSpy('disconnect');
			connectedSockets.push(newSocket);
			return newSocket;
		});

		// static signalling socket preferring 2 of 4 total signalling servers
		signallingServerService.getSignallingServerSpecs.andReturn([SIGNALLING_SPEC_1, SIGNALLING_SPEC_2, SIGNALLING_SPEC_3, SIGNALLING_SPEC_4]);
		signallingServerService.getPreferredNumberOfSockets.andReturn(2);
	
		asyncExecService.setInterval.andCallFake(function(callback) {
			connectivityCheckCallback = callback;
		});

		timingService.getCurrentTimeInMilliseconds.andReturn(currentTime);
	});

	describe('when connecting to initial server set', function() {

		beforeEach(function() {
			redundantSignallingSocket.initialize(localNode);
		});

		it('will connect to the number of servers specified', function() {
			console.log(connectedServerSpecs);
			expect(connectedServerSpecs.length).toEqual(2);
		});

		it('will schedule the connectivity check', function() {
			expect(connectivityCheckCallback).toEqual(jasmine.any(Function));
		});

		it('will send a register message when a socket connects', function() {
			var socketRegistered = false;
			connectedSockets[0].on("register", function() {
				socketRegistered = true;
			});
			connectedSockets[0].emit("connect");
			expect(socketRegistered).toBe(true);
		});

		it('will propagate answer events from the sockets', function() {
			var answerEvent = null;
			var ANSWER_EVENT = "ANSWER_EVENT";
			redundantSignallingSocket.on("answer", function(e) {
				answerEvent = e;
			});
			connectedSockets[0].emit("answer", ANSWER_EVENT);
			expect(answerEvent).toBe(ANSWER_EVENT);
		});

		it('will propagate offer events from the sockets', function() {
			var offerEvent = null;
			var OFFER_EVENT = "OFFER_EVENT";
			redundantSignallingSocket.on("offer", function(e) {
				offerEvent = e;
			});
			connectedSockets[1].emit("offer", OFFER_EVENT);
			expect(offerEvent).toBe(OFFER_EVENT);
		});
	});

	describe('when connected to a server set', function() {

		beforeEach(function() {
			redundantSignallingSocket.initialize(localNode);
		});

		it('will connect to a server it has not attempted to connect to upon disconnect', function() {
			connectedSockets[0].emit("disconnect");
			//expect(connectedSockets.listenerCount()).toEqual(0);
			expect(connectedServerSpecs.length).toEqual(3);
			expect(connectedServerSpecs[2]).not.toEqual(connectedServerSpecs[0]);
			expect(connectedServerSpecs[2]).not.toEqual(connectedServerSpecs[1]);
		});

		it('will connect to a server it has not attempted to connect to upon error', function() {
			connectedSockets[0].emit("error");
			expect(connectedServerSpecs.length).toEqual(3);
			expect(connectedServerSpecs[2]).not.toEqual(connectedServerSpecs[0]);
			expect(connectedServerSpecs[2]).not.toEqual(connectedServerSpecs[1]);
		});

		it('will connect to a server it has not attempted to connect to upon connect_error', function() {
			connectedSockets[0].io.emit("connect_error");
			expect(connectedServerSpecs.length).toEqual(3);
			expect(connectedServerSpecs[2]).not.toEqual(connectedServerSpecs[0]);
			expect(connectedServerSpecs[2]).not.toEqual(connectedServerSpecs[1]);
		});

		it('will connect to the server it least recently disconnected from when reconnecting', function() {
			connectedSockets[0].emit("disconnect");
			
			// A minute later...
			timingService.getCurrentTimeInMilliseconds.andReturn(currentTime + ONE_MINUTE);
			connectedSockets[1].emit("disconnect");
			
			// Another minute later...
			timingService.getCurrentTimeInMilliseconds.andReturn(currentTime + 2*ONE_MINUTE);
			connectedSockets[2].emit("disconnect");				
			
			expect(connectedServerSpecs[4]).toEqual(connectedServerSpecs[0]);
		});

		it('will not attempt to connect to servers it disconnectedf from less than 30 seconds ago', function() {
			connectedSockets[0].emit("disconnect");
			connectedSockets[1].emit("disconnect");
			connectedSockets[2].emit("disconnect");				
			
			expect(connectedServerSpecs.length).toEqual(4);
		});
	});

	describe('when executing connectivity checks', function() {

		beforeEach(function() {
			redundantSignallingSocket.initialize(localNode);
		});

		it('connects to an eligible server if the current number of connected servers is less than preferred', function() {
			connectedSockets[0].emit("disconnect");
			connectedSockets[1].emit("disconnect");
			connectedSockets[2].emit("disconnect");

			expect(connectedServerSpecs.length).toEqual(4);

			timingService.getCurrentTimeInMilliseconds.andReturn(currentTime + 2 * ONE_MINUTE);
			connectivityCheckCallback();

			expect(connectedServerSpecs.length).toEqual(5);
		});

		it('updates the registration with the signalling servers', function() {
			var firstSocketRegistered = false;
			var secondSocketRegistered = false;

			connectedSockets[0].on("register", function() {
				firstSocketRegistered = true;
			});

			connectedSockets[1].on("register", function() {
				secondSocketRegistered = true;
			});

			connectivityCheckCallback();

			expect(firstSocketRegistered).toBe(true);
			expect(secondSocketRegistered).toBe(true);
		});
	});
});