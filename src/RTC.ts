import {EventEmitter} from 'events';
import {OfferMessage, SignallingService} from './SignallingService';
import {ChannelFactory} from './ChannelFactory';
import {MetadataProvider} from 'cyclon.p2p';
import {WebRTCCyclonNodePointer} from './WebRTCCyclonNodePointer';
import {Channel} from './Channel';
import {TimeoutError} from 'cyclon.p2p-common';

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
            this.signallingService.on('offer', (message: OfferMessage) => {
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

    async openChannel(type: string, remotePointer: WebRTCCyclonNodePointer): Promise<Channel> {
        const channel = this.channelFactory.createChannel(remotePointer);

        try {
            await channel.createOffer(type);
            await channel.sendOffer();
            await channel.startListeningForRemoteIceCandidates();
            const answerMessage = await channel.waitForAnswer();
            await channel.handleAnswer(answerMessage);
            await channel.startSendingIceCandidates();
            await channel.waitForChannelToOpen();
            await channel.stopSendingIceCandidates();
            return channel;
        } catch (error) {
            // If an error occurs here, cleanup our attempted channel
            // establishment resources before continuing
            channel.close();
            throw error;
        }
    }

    private async handleOffer(offerMessage: OfferMessage): Promise<void> {
        const channelType = offerMessage.channelType;
        const listener: (channel: Channel) => unknown = this.channelListeners[channelType];
        const remotePointer = offerMessage.sourcePointer;
        const correlationId = offerMessage.correlationId;

        this.emit('offerReceived', channelType, offerMessage.sourcePointer);

        if (listener) {
            const channel = this.channelFactory.createChannel(remotePointer, correlationId);
            try {
                await channel.createAnswer(offerMessage.sessionDescription);
                await channel.startListeningForRemoteIceCandidates();
                await channel.sendAnswer();
                await channel.startSendingIceCandidates();
                await channel.waitForChannelEstablishment();
                await channel.waitForChannelToOpen();
                await channel.stopSendingIceCandidates();
                await listener(channel);
            } catch (error) {
                if (error instanceof TimeoutError) {
                    this.emit('incomingTimeout', channelType, offerMessage.sourcePointer);
                    channel.close();
                } else {
                    this.emit('incomingError', channelType, offerMessage.sourcePointer, error);
                    channel.close();
                }
                throw error;
            }
        } else {
            console.warn('No listener for channel type ' + channelType + ', ignoring offer!');
        }
    }
}
