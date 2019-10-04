import {StaticSignallingServerService} from './StaticSignallingServerService';
import {TimingService} from './TimingService';
import {SocketFactory} from './SocketFactory';
import {HttpRequestService} from './HttpRequestService';
import {RedundantSignallingSocket} from './RedundantSignallingSocket';
import {SocketIOSignallingService} from './SocketIOSignallingService';
import {IceCandidateBatchingSignallingService} from './IceCandidateBatchingSignallingService';
import {NativeRTCObjectFactory} from './NativeRTCObjectFactory';
import {ChannelFactory} from './ChannelFactory';
import {PeerConnectionFactory} from './PeerConnectionFactory';
import {RTC} from './rtc';
import {SignallingServerSelector} from './SignallingServerSelector';
import {asyncExecService} from "cyclon.p2p-common";

/*
 * Default values
 */
const DEFAULT_BATCHING_DELAY_MS = 300;
const DEFAULT_SIGNALLING_SERVERS = [
    {
        "socket": {
            "server": "http://cyclon-js-ss-one.herokuapp.com"
        },
        "signallingApiBase": "http://cyclon-js-ss-one.herokuapp.com"
    },
    {
        "socket": {
            "server": "http://cyclon-js-ss-two.herokuapp.com"
        },
        "signallingApiBase": "http://cyclon-js-ss-two.herokuapp.com"
    },
    {
        "socket": {
            "server": "http://cyclon-js-ss-three.herokuapp.com"
        },
        "signallingApiBase": "http://cyclon-js-ss-three.herokuapp.com"
    }
];
const DEFAULT_ICE_SERVERS = [
    // The public Google STUN server
    {urls: ['stun:stun.l.google.com:19302']},
];
const DEFAULT_CHANNEL_STATE_TIMEOUT_MS = 30000;
const DEFAULT_SIGNALLING_SERVER_RECONNECT_DELAY_MS = 5000;

export {
    RTC,
    ChannelFactory,
    NativeRTCObjectFactory,
    TimingService,
    HttpRequestService,
    RedundantSignallingSocket,
    SignallingServerSelector,
    StaticSignallingServerService,
    SocketIOSignallingService,
    SocketFactory,
    PeerConnectionFactory,
    IceCandidateBatchingSignallingService
}

/**
 * Build the angular cyclon-rtc module
 *
 * @deprecated This is going to go very soon
 *
 * @param angular The angular core module
 */
module.exports.buildAngularModule = function (angular: any) {
    var rtcModule = angular.module("cyclon-rtc", []);

    rtcModule.service("RTC", ["IceCandidateBatchingSignallingService", "ChannelFactory", RTC]);
    rtcModule.service("ChannelFactory", ["PeerConnectionFactory", "IceCandidateBatchingSignallingService", "$log", "ChannelStateTimeout", ChannelFactory]);
    rtcModule.service("PeerConnectionFactory", ["RTCObjectFactory", "$log", "IceServers", "ChannelStateTimeout", PeerConnectionFactory]);
    rtcModule.service("RTCObjectFactory", ["$log", NativeRTCObjectFactory]);
    rtcModule.factory("AsyncExecService", asyncExecService);
    rtcModule.service("IceCandidateBatchingSignallingService", ["AsyncExecService", "SignallingService", "IceCandidateBatchingDelay", IceCandidateBatchingSignallingService]);
    rtcModule.service("SignallingService", ["SignallingSocket", "$log", "HttpRequestService", "StorageService", SocketIOSignallingService]);
    rtcModule.service("SignallingSocket", ["SignallingServerService", "SocketFactory", "$log", "AsyncExecService", "SignallingServerSelector", RedundantSignallingSocket]);
    rtcModule.service("SignallingServerSelector", ["SignallingServerService", "StorageService", "TimingService", "SignallingServerReconnectDelay", SignallingServerSelector]);
    rtcModule.service("HttpRequestService", HttpRequestService);
    rtcModule.service("SignallingServerService", ["SignallingServers", StaticSignallingServerService]);
    rtcModule.service("SocketFactory", SocketFactory);
    rtcModule.service("TimingService", TimingService);
    rtcModule.factory("StorageService", sessionStorage);

    /**
     * Default config values
     */
    rtcModule.value("IceServers", DEFAULT_ICE_SERVERS);
    rtcModule.value("ChannelStateTimeout", DEFAULT_CHANNEL_STATE_TIMEOUT_MS);
    rtcModule.value("IceCandidateBatchingDelay", DEFAULT_BATCHING_DELAY_MS);
    rtcModule.value("SignallingServers", DEFAULT_SIGNALLING_SERVERS);
    rtcModule.value("SignallingServerReconnectDelay", DEFAULT_SIGNALLING_SERVER_RECONNECT_DELAY_MS);

    return rtcModule;
};