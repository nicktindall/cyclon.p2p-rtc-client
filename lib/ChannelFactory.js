var Utils = require("cyclon.p2p-common");
var Channel = require("./Channel");

function ChannelFactory(asyncExecService, peerConnectionFactory, signallingService, logger) {

    Utils.checkArguments(arguments, 4);

    this.asyncExecService = asyncExecService;
    this.peerConnectionFactory = peerConnectionFactory;
    this.signallingService = signallingService;
    this.logger = logger;

    this.createChannel = function (remotePeer, correlationId) {
        return new Channel(this.asyncExecService, 
            remotePeer,
            correlationId,
            this.peerConnectionFactory.createPeerConnection(),
            this.signallingService,
            this.logger);
    }
}

module.exports = ChannelFactory;
