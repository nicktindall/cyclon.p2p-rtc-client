import url from 'url';
import {MetadataProvider} from 'cyclon.p2p';
import {BufferingEventEmitter, generateGuid, Logger, shuffleArray, UnreachableError} from 'cyclon.p2p-common';
import {HttpRequestService} from './HttpRequestService';
import {SignallingSocket} from './SignallingSocket';
import {AnswerMessage, IceCandidatesMessage, SignallingMessage, SignallingService} from './SignallingService';
import {SignallingServerSpec} from './SignallingServerSpec';
import {WebRTCCyclonNodePointer} from './WebRTCCyclonNodePointer';

const POINTER_SEQUENCE_STORAGE_KEY = 'cyclon-rtc-pointer-sequence-counter';
const RTC_LOCAL_ID_STORAGE_KEY = 'cyclon-rtc-local-node-id';

export class SocketIOSignallingService implements SignallingService {

    private localId?: string;
    private correlationIdCounter: number;
    private answerEmitter: BufferingEventEmitter;
    private eventEmitter: BufferingEventEmitter;
    private pointerCounter: number;
    private metadataProviders: { [key: string]: MetadataProvider };

    constructor(private readonly signallingSocket: SignallingSocket,
                private readonly logger: Logger,
                private readonly httpRequestService: HttpRequestService,
                private readonly storage: Storage) {
        this.correlationIdCounter = 0;
        this.pointerCounter = 0;
        this.metadataProviders = {};
        this.eventEmitter = new BufferingEventEmitter();
        this.answerEmitter = new BufferingEventEmitter();

        // Listen for signalling messages
        signallingSocket.on('answer', (message: SignallingMessage) => {
            logger.debug(`Answer received from: ${message.sourceId} (correlationId ${message.correlationId})`);
            this.answerEmitter.emit(`answer-${message.correlationId}`, message);
        });
        signallingSocket.on('offer', (message: SignallingMessage) => {
            logger.debug(`Offer received from: ${message.sourceId} (correlationId ${message.correlationId})`);
            this.eventEmitter.emit('offer', message);
        });
        signallingSocket.on('candidates', (message: IceCandidatesMessage) => {
            logger.debug(`${message.iceCandidates.length} ICE Candidates received from: ${message.sourceId} (correlationId ${message.correlationId})`);
            this.eventEmitter.emit(`candidates-${message.sourceId}-${message.correlationId}`, message);
        });
    }

    on(eventType: string, handler: (...args: any[]) => void): void {
        this.eventEmitter.on(eventType, handler);
    }

    removeAllListeners(eventType: string) {
        this.eventEmitter.removeAllListeners(eventType);
    }

    /**
     * Connect to the signalling server(s)
     */
    connect(sessionMetadataProviders: { [key: string]: MetadataProvider }, rooms: string[]) {
        this.metadataProviders = sessionMetadataProviders || {};
        this.signallingSocket.connect(this, rooms);
    }

    /**
     * Send an offer message over the signalling channel
     *
     * @param destinationNode
     * @param type
     * @param sessionDescription
     */
    async sendOffer(destinationNode: WebRTCCyclonNodePointer, type: string, sessionDescription: RTCSessionDescription): Promise<number> {
        this.logger.debug(`Sending offer SDP to ${destinationNode.id}`);

        const correlationId = this.correlationIdCounter++;
        const localPointer = this.createNewPointer();

        await this.postToFirstAvailableServer(destinationNode, SocketIOSignallingService.randomiseServerOrder(destinationNode), './api/offer', {
            channelType: type,
            sourceId: localPointer.id,
            correlationId: correlationId,
            sourcePointer: localPointer,
            destinationId: destinationNode.id,
            sessionDescription: sessionDescription
        });
        return correlationId;
    }

    async waitForAnswer(correlationId: number): Promise<AnswerMessage> {
        try {
            return await new Promise((resolve) => {
                this.answerEmitter.once(`answer-${correlationId}`, (answer: AnswerMessage) => {
                    resolve(answer);
                });
            })
        } finally {
            this.answerEmitter.removeAllListeners(`answer-${correlationId}`);
        }
    }

    /**
     * Create a new pointer to this RTC node
     */
    createNewPointer(): WebRTCCyclonNodePointer {
        const pointer: WebRTCCyclonNodePointer = {
            id: this.getLocalId(),
            age: 0,
            seq: this.getNextPointerSequenceNumber(),
            metadata: {},
            signalling: []
        };

        if (this.metadataProviders) {
            for (const metaDataKey in this.metadataProviders) {
                try {
                    pointer.metadata[metaDataKey] = this.metadataProviders[metaDataKey]();
                } catch (e) {
                    this.logger.error(`An error occurred generating metadata (key: ${metaDataKey}`, e);
                }
            }
        }

        // Populate current signalling details
        pointer.signalling = this.signallingSocket.getCurrentServerSpecs();
        return pointer;
    }

    /**
     * Get the next pointer sequence number (restoring from storage if it's present)
     */
    private getNextPointerSequenceNumber() {
        if (this.pointerCounter === 0) {
            const storedSequenceNumber = this.storage.getItem(POINTER_SEQUENCE_STORAGE_KEY);
            this.pointerCounter = storedSequenceNumber !== null ? parseInt(storedSequenceNumber) : 0;
        }
        const returnValue = this.pointerCounter++;
        this.storage.setItem(POINTER_SEQUENCE_STORAGE_KEY, this.pointerCounter.toString());
        return returnValue;
    }

    /**
     Get the local node ID
     */
    getLocalId(): string {
        if (this.localId === undefined) {
            const storedId = this.storage.getItem(RTC_LOCAL_ID_STORAGE_KEY);
            if (storedId !== null) {
                this.localId = storedId;
            } else {
                this.localId = generateGuid();
                this.storage.setItem(RTC_LOCAL_ID_STORAGE_KEY, this.localId as string);
            }
        }
        return this.localId as string;
    }

    /**
     * Send an answer message over the signalling channel
     *
     * @param destinationNode
     * @param correlationId
     * @param sessionDescription
     */
    async sendAnswer(destinationNode: WebRTCCyclonNodePointer, correlationId: number, sessionDescription: RTCSessionDescription): Promise<void> {
        this.logger.debug(`Sending answer SDP to ${destinationNode.id}`);

        return await this.postToFirstAvailableServer(destinationNode, SocketIOSignallingService.randomiseServerOrder(destinationNode), './api/answer', {
            sourceId: this.getLocalId(),
            correlationId: correlationId,
            destinationId: destinationNode.id,
            sessionDescription: sessionDescription
        });
    }

    /**
     * Send an array of one or more ICE candidates
     */
    async sendIceCandidates(destinationNode: WebRTCCyclonNodePointer, correlationId: number, iceCandidates: RTCIceCandidate[]): Promise<void> {
        iceCandidates.forEach((candidate: RTCIceCandidate) => {
            this.logger.debug(`Sending ice candidate: ${candidate.candidate} to ${destinationNode.id}`);
        });

        return await this.postToFirstAvailableServer(destinationNode, SocketIOSignallingService.randomiseServerOrder(destinationNode), './api/candidates', {
            sourceId: this.getLocalId(),
            correlationId: correlationId,
            destinationId: destinationNode.id,
            iceCandidates: iceCandidates
        });
    };

    /**
     * Post an object to the first available signalling server
     *
     * @param destinationNode
     * @param signallingServers
     * @param path
     * @param message
     * @returns {Promise}
     */
    private async postToFirstAvailableServer(destinationNode: WebRTCCyclonNodePointer, signallingServers: SignallingServerSpec[], path: string, message: any): Promise<any> {

        if (signallingServers.length === 0) {
            throw new UnreachableError(SocketIOSignallingService.createUnreachableErrorMessage(destinationNode));
        } else {
            try {
                await this.httpRequestService.post(url.resolve(signallingServers[0].signallingApiBase, path), message);
            } catch (error) {
                this.logger.warn(`An error occurred sending signalling message using ${signallingServers[0].signallingApiBase} trying next signalling server`, error);
                await this.postToFirstAvailableServer(destinationNode, signallingServers.slice(1), path, message);
            }
        }
    }

    private static createUnreachableErrorMessage(destinationNode: WebRTCCyclonNodePointer) {
        return `Unable to contact node ${destinationNode.id} using signalling servers: ${JSON.stringify(destinationNode.signalling.map(function (server: SignallingServerSpec) {
            return server.signallingApiBase
        }))}`;
    }

    private static randomiseServerOrder(destinationNode: WebRTCCyclonNodePointer) {
        return shuffleArray(destinationNode.signalling.slice(0));
    }
}
