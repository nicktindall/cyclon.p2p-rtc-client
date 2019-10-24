'use strict';

var ClientMocks = require("./ClientMocks");
var {PeerConnectionFactory} = require("../lib/PeerConnectionFactory");

describe("The PeerConnectionFactory", function() {

    var ICE_SERVERS = [
        {
            "urls": ["url11", "url12"],
            "username": "username1",
            "credential": "credential1"
        },
        {
            "urls": "url2",
            "username": "username2",
            "credential": "credential2"
        }
    ];

    var CHANNEL_STATE_TIMEOUT = 5011;

    var rtcObjectFactory,
        logger,
        peerConnectionFactory;

    beforeEach(function() {
        rtcObjectFactory = ClientMocks.mockRtcObjectFactory();
        logger = ClientMocks.mockLoggingService();

        rtcObjectFactory.createRTCPeerConnection.and.returnValue(ClientMocks.mockRtcPeerConnection());
    });

    describe("when creating a new peer connection", function() {

        describe("and there are ICE servers", function() {

            beforeEach(function() {
                peerConnectionFactory = new PeerConnectionFactory(rtcObjectFactory, logger, ICE_SERVERS, CHANNEL_STATE_TIMEOUT);
            });

            it("creates the ICE candidates", function() {
                peerConnectionFactory.createPeerConnection();

                expect(rtcObjectFactory.createRTCPeerConnection).toHaveBeenCalledWith({
                    iceServers: ICE_SERVERS
                });
            });
        });

        describe("and there are no ICE servers", function() {

            beforeEach(function() {
                peerConnectionFactory = new PeerConnectionFactory(rtcObjectFactory, logger, null, CHANNEL_STATE_TIMEOUT);
            });

            it("generates a peerConnectionConfig with an empty iceServers array", function() {
                peerConnectionFactory.createPeerConnection();

                expect(rtcObjectFactory.createRTCPeerConnection).toHaveBeenCalledWith({
                    iceServers: []
                });
            });
        });
    });
});