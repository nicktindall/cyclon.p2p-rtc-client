import {Promise} from 'bluebird';
import {Logger, BufferingEventEmitter} from 'cyclon.p2p-common';
import {AnswerMessage, SignallingService} from './SignallingService';
import {PeerConnection} from "./PeerConnection";
import {WebRTCCyclonNodePointer} from "./WebRTCCyclonNodePointer";

export class Channel {

    private channelEstablishedEventEmitter:BufferingEventEmitter;
    private messages: BufferingEventEmitter;
    private resolvedCorrelationId?: number;
    private channelType?: string;
    private rtcDataChannel?: RTCDataChannel;
    private lastOutstandingPromise?: Promise<any>;

    constructor(private readonly remotePeer: WebRTCCyclonNodePointer,
                private readonly correlationId: number | undefined,
                private peerConnection: PeerConnection,
                private signallingService: SignallingService,
                private readonly logger: Logger,
                private readonly channelStateTimeoutMs: number) {
        this.resolvedCorrelationId = correlationId;
        this.channelEstablishedEventEmitter = new BufferingEventEmitter();
        this.messages = new BufferingEventEmitter();

        peerConnection.on("channelCreated", (channel: RTCDataChannel) => {
            this.rtcDataChannel = channel;
            this.addMessageListener();
            this.channelEstablishedEventEmitter.emit("channelEstablished");
        });
    }

    private remoteCandidatesEventId(): string {
        return `candidates-${this.remotePeer.id}-${this.verifyCorrelationId()}`;
    }

    private correlationIdIsResolved(): boolean {
        return this.resolvedCorrelationId !== undefined;
    }

    private verifyCorrelationId(): number {
        if (!this.correlationIdIsResolved()) {
            throw new Error("Correlation ID is not resolved");
        }
        return this.resolvedCorrelationId as number;
    }

    startListeningForRemoteIceCandidates(): void {
        this.verifyCorrelationId();

        this.signallingService.on(this.remoteCandidatesEventId(), (message: any) => {
            try {
                this.peerConnection.processRemoteIceCandidates(message.iceCandidates);
            } catch (error) {
                this.logger.error("Error handling peer candidates", error);
            }
        });
    }

    getRemotePeer(): WebRTCCyclonNodePointer {
        return this.remotePeer;
    }

    createOffer(type: string): Promise<RTCSessionDescriptionInit> {
        this.channelType = type;
        return this.peerConnection.createOffer();
    }

    createAnswer(remoteDescription: RTCSessionDescriptionInit): Promise<void> {
        return this.peerConnection.createAnswer(remoteDescription);
    }

    sendAnswer(): Promise<void> {
        const correlationId = this.verifyCorrelationId();

        this.lastOutstandingPromise = this.signallingService.sendAnswer(
            this.remotePeer,
            correlationId,
            this.peerConnection.getLocalDescription());
        return this.lastOutstandingPromise;
    }

    waitForChannelEstablishment(): Promise<Channel> {
        this.lastOutstandingPromise = new Promise((resolve) => {
            this.channelEstablishedEventEmitter.once('channelEstablished', () => {
                resolve(this);
            });
        }).timeout(this.channelStateTimeoutMs, "Data channel establishment timeout exceeded");
        return this.lastOutstandingPromise;
    }

    startSendingIceCandidates(): void {
        const correlationId = this.verifyCorrelationId();

        this.peerConnection.on("iceCandidates", (candidates: RTCIceCandidate[]) => {
            this.signallingService.sendIceCandidates(this.remotePeer, correlationId, candidates).catch((error) => {
                this.logger.warn(`An error occurred sending ICE candidates to ${this.remotePeer.id}`, error);
            });
        });
        this.peerConnection.startEmittingIceCandidates();
    }

    stopSendingIceCandidates(): Channel {
        this.peerConnection.removeAllListeners("iceCandidates");
        return this;
    }

    sendOffer(): Promise<void> {
        this.lastOutstandingPromise = this.signallingService.sendOffer(
            this.remotePeer,
            this.channelType as string,
            this.peerConnection.getLocalDescription())
            .then((correlationId) => {
                this.resolvedCorrelationId = correlationId;
            });
        return this.lastOutstandingPromise as Promise<void>;
    }

    waitForAnswer(): Promise<AnswerMessage> {
        this.lastOutstandingPromise = this.signallingService.waitForAnswer(this.verifyCorrelationId());
        return this.lastOutstandingPromise as Promise<AnswerMessage>;
    }

    handleAnswer(answerMessage: AnswerMessage): Promise<void> {
        return this.peerConnection.handleAnswer(answerMessage);
    }

    waitForChannelToOpen(): Promise<RTCDataChannel> {
        return this.peerConnection.waitForChannelToOpen();
    }

    private addMessageListener(): void {
        (this.rtcDataChannel as RTCDataChannel).onmessage = (messageEvent) => {
            const parsedMessage = this.parseMessage(messageEvent.data as string);
            this.messages.emit(parsedMessage.type, parsedMessage.payload);
        };
    }

    private parseMessage(message: string): ChannelMessage {
        try {
            return JSON.parse(message);
        } catch (e) {
            throw new Error("Bad message received from " + this.remotePeer.id + " : '" + message + "'");
        }
    }

    /**
     * Send a message
     *
     * @param type the type of message to send
     * @param message The message to send
     */
    send(type: string, message?: any) {
        if (this.rtcDataChannel === undefined) {
            throw new Error("Data channel has not yet been established!");
        }
        const channelState = String(this.rtcDataChannel.readyState);
        if ("open" !== channelState) {
            throw new Error(`Data channel must be in 'open' state to send messages (actual state: ${channelState})`);
        }
        this.rtcDataChannel.send(JSON.stringify({
            type: type,
            payload: message || {}
        }));
    }

    /**
     * Wait an amount of time for a particular type of message on a data channel
     *
     * @param messageType
     * @param timeoutInMilliseconds
     */
    receive(messageType: string, timeoutInMilliseconds: number) {
        let handlerFunction: (... args: any[]) => void;

        this.lastOutstandingPromise = new Promise((resolve, reject) => {

            if (this.rtcDataChannel === undefined || "open" !== String(this.rtcDataChannel.readyState)) {
                reject(new Error(`Data channel must be in 'open' state to receive ${messageType} message`));
            }

            //
            // Add the handler
            //
            handlerFunction = (message: string): void => {
                resolve(message);
            };

            this.messages.once(messageType, handlerFunction);
        })
        .timeout(timeoutInMilliseconds, "Timeout reached waiting for '" + messageType + "' message (from " + this.remotePeer.id + ")")
        //
        // If cancel or timeout occurs, remove the message listener
        //
        .catch(Promise.TimeoutError, (e) => {
            this.messages.removeListener(messageType, handlerFunction);
            throw e;
        })
        .catch(Promise.CancellationError, (e) => {
            this.messages.removeListener(messageType, handlerFunction);
            throw e;
        });

        return this.lastOutstandingPromise;
    }

    cancel() {
        if (this.lastOutstandingPromise && this.lastOutstandingPromise.isPending()) {
            this.lastOutstandingPromise.cancel();
        }
    }

    close() {
        if (this.signallingService !== undefined) {
            if (this.correlationIdIsResolved()) {
                this.signallingService.removeAllListeners(this.remoteCandidatesEventId());
            }
            delete this.signallingService;
        }

        if (this.messages !== undefined) {
            this.messages.removeAllListeners();
            delete this.messages;
        }

        if (this.peerConnection !== undefined) {
            this.peerConnection.removeAllListeners();
            this.peerConnection.close();
            delete this.peerConnection;
        }

        delete this.rtcDataChannel;
    };
}

interface ChannelMessage {
    type: string;
    payload: any;
}