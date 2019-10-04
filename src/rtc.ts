import {Promise} from 'bluebird';
import {EventEmitter} from 'events';
import {OfferMessage, SignallingService} from "./SignallingService";
import {ChannelFactory} from "./ChannelFactory";
import {MetadataProvider} from "cyclon.p2p";
import {WebRTCCyclonNodePointer} from "./WebRTCCyclonNodePointer";
import {Channel} from "./Channel";

export class RTC extends EventEmitter {

    private readonly channelListeners: { [type: string]: (value: Channel) => unknown };
    private connected: boolean;

    constructor(private readonly signallingService: SignallingService,
                private readonly channelFactory: ChannelFactory) {
        super();
        this.channelListeners = {};
        this.connected = false;
    }

    connect(metadataProviders: { [key: string]: MetadataProvider }, rooms: string[]) {
        if (!this.connected) {
            this.signallingService.connect(metadataProviders, rooms);
            this.signallingService.on("offer", (message: OfferMessage) => {
                this.handleOffer(message);
            });
            this.connected = true;
        }
    }

    createNewPointer(): WebRTCCyclonNodePointer {
        return this.signallingService.createNewPointer();
    }

    getLocalId(): string {
        return this.signallingService.getLocalId();
    }

    onChannel(type: string, callback: (value: Channel) => unknown): void {
        this.channelListeners[type] = callback;
    }

    openChannel(type: string, remotePointer: WebRTCCyclonNodePointer): Promise<Channel> {
        const channel = this.channelFactory.createChannel(remotePointer);

        return channel.createOffer(type)
            .then(() => channel.sendOffer())
            .then(() => channel.startListeningForRemoteIceCandidates())
            .then(() => channel.waitForAnswer())
            .then((answerMessage) => channel.handleAnswer(answerMessage))
            .then(() => channel.startSendingIceCandidates())
            .then(() => channel.waitForChannelToOpen())
            .then(() => channel.stopSendingIceCandidates())
            .catch(function (error) {
                // If an error occurs here, cleanup our attempted channel
                // establishment resources before continuing
                channel.close();
                throw error;
            });
    }

    private handleOffer(offerMessage: OfferMessage) {
        const channelType = offerMessage.channelType;
        const listener: (channel: Channel) => unknown = this.channelListeners[channelType];
        const remotePointer = offerMessage.sourcePointer;
        const correlationId = offerMessage.correlationId;

        this.emit("offerReceived", channelType, offerMessage.sourcePointer);

        if (listener) {
            const channel = this.channelFactory.createChannel(remotePointer, correlationId);

            channel.createAnswer(offerMessage.sessionDescription)
                .then(() => channel.startListeningForRemoteIceCandidates())
                .then(() => channel.sendAnswer())
                .then(() => channel.startSendingIceCandidates())
                .then(() => channel.waitForChannelEstablishment())
                .then(() => channel.waitForChannelToOpen())
                .then(() => channel.stopSendingIceCandidates())
                .then(listener)
                .catch(Promise.TimeoutError, () => {
                    this.emit("incomingTimeout", channelType, offerMessage.sourcePointer);
                    channel.close();
                })
                .catch((e: Error) => {
                    this.emit("incomingError", channelType, offerMessage.sourcePointer, e);
                    channel.close();
                });
        } else {
            console.warn("No listener for channel type " + channelType + ", ignoring offer!");
        }
    }
}
