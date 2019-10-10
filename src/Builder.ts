import {asyncExecService, consoleLogger, Logger, newInMemoryStorage} from 'cyclon.p2p-common';
import {RTC} from './rtc';
import {ChannelFactory} from './ChannelFactory';
import {SocketIOSignallingService} from './SocketIOSignallingService';
import {RedundantSignallingSocket} from './RedundantSignallingSocket';
import {IceCandidateBatchingSignallingService} from './IceCandidateBatchingSignallingService'
import {StaticSignallingServerService} from './StaticSignallingServerService';
import {SignallingServerSpec} from './SignallingServerSpec';
import {SocketFactory} from './SocketFactory';
import {SignallingServerSelector} from './SignallingServerSelector';
import {TimingService} from './TimingService';
import {HttpRequestService} from './HttpRequestService';
import {PeerConnectionFactory} from './PeerConnectionFactory';
import {NativeRTCObjectFactory} from './NativeRTCObjectFactory';
import {
    DEFAULT_BATCHING_DELAY_MS,
    DEFAULT_CHANNEL_STATE_TIMEOUT_MS,
    DEFAULT_ICE_SERVERS,
    DEFAULT_SIGNALLING_SERVER_RECONNECT_DELAY_MS,
    DEFAULT_SIGNALLING_SERVERS
} from './Defaults';
import {SignallingSocket} from './SignallingSocket';
import {SignallingService} from './SignallingService';

interface BuilderResult {
    rtc: RTC,
    signallingSocket: SignallingSocket;
}

export class Builder {

    private signallingServers?: SignallingServerSpec[];
    private logger?: Logger;
    private storage?: Storage;
    private reconnectDelayInMillis?: number;
    private channelStateTimeoutMillis?: number;
    private iceServers?: RTCIceServer[];
    private signallingSocket?: SignallingSocket;
    private result?: BuilderResult;
    private signallingService?: SignallingService;

    withLogger(logger: Logger): Builder {
        this.logger = logger;
        return this;
    }

    withSignallingServers(signallingServerSpecs: SignallingServerSpec[]): Builder {
        this.signallingServers = signallingServerSpecs;
        return this;
    }

    withStorage(storage: Storage): Builder {
        this.storage = storage;
        return this;
    }

    withSignallingServerReconnectDelay(reconnectDelayInMillis: number): Builder {
        this.reconnectDelayInMillis = reconnectDelayInMillis;
        return this;
    }

    withChannelStateChangeTimeout(channelStateTimeoutMillis: number): Builder {
        this.channelStateTimeoutMillis = channelStateTimeoutMillis;
        return this;
    }

    withIceServers(iceServers: RTCIceServer[]): Builder {
        this.iceServers = iceServers;
        return this;
    }

    build(): BuilderResult {
        if (!this.result) {
            const peerConnectionFactory = new PeerConnectionFactory(new NativeRTCObjectFactory(this.getLogger()), this.getLogger(), this.getIceServers(), this.getChannelStateTimeout());
            const signallingService = this.getSignallingService();
            this.result = {
                rtc: new RTC(signallingService, new ChannelFactory(peerConnectionFactory, signallingService, this.getLogger(), this.getChannelStateTimeout())),
                signallingSocket: this.getSignallingSocket()
            };
        }
        return this.result;
    }

    private getSignallingService(): SignallingService {
        if (!this.signallingService) {
            const socketIOSignallingService = new SocketIOSignallingService(this.getSignallingSocket(), this.getLogger(), new HttpRequestService(), this.getStorage());
            this.signallingService = new IceCandidateBatchingSignallingService(asyncExecService(), socketIOSignallingService, DEFAULT_BATCHING_DELAY_MS, this.getLogger());
        }
        return this.signallingService;
    }

    private getSignallingSocket(): SignallingSocket {
        if (!this.signallingSocket) {
            const storage = this.getStorage();
            const signallingServerService = new StaticSignallingServerService(this.getSignallingServers());
            const signallingServerSelector = new SignallingServerSelector(signallingServerService, storage, new TimingService(), this.getReconnectDelay());
            this.signallingSocket = new RedundantSignallingSocket(signallingServerService, new SocketFactory(), this.getLogger(), asyncExecService(), signallingServerSelector);
        }
        return this.signallingSocket;
    }

    private getIceServers() {
        return this.iceServers === undefined ? DEFAULT_ICE_SERVERS : this.iceServers;
    }

    private getChannelStateTimeout() {
        return this.channelStateTimeoutMillis === undefined ? DEFAULT_CHANNEL_STATE_TIMEOUT_MS : this.channelStateTimeoutMillis;
    }

    private getReconnectDelay(): number {
        return this.reconnectDelayInMillis === undefined ? DEFAULT_SIGNALLING_SERVER_RECONNECT_DELAY_MS : this.reconnectDelayInMillis;
    }

    private getLogger() {
        return this.logger || consoleLogger();
    }

    private getStorage() {
        if (!this.storage) {
            this.storage = newInMemoryStorage();
        }
        return this.storage;
    }

    private getSignallingServers(): SignallingServerSpec[] {
        return this.signallingServers === undefined ? JSON.parse(JSON.stringify(DEFAULT_SIGNALLING_SERVERS)) : this.signallingServers;
    }
}