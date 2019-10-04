import {Promise} from 'bluebird';
import {AsyncExecService, Logger} from "cyclon.p2p-common";
import {AnswerMessage, SignallingService} from "./SignallingService";
import {MetadataProvider} from "cyclon.p2p";
import {WebRTCCyclonNodePointer} from "./WebRTCCyclonNodePointer";

/**
 * A decorator for a signalling service that batches ICE candidate messages to
 * reduce candidate messages when the transport is expensive
 *
 * @param asyncExecService
 * @param signallingService
 * @param batchingDelayMs
 * @constructor
 */
export class IceCandidateBatchingSignallingService implements SignallingService {

    private queuedCandidates: any;
    private deliveryPromises: any;

    constructor(private readonly asyncExecService: AsyncExecService,
                private readonly signallingService: SignallingService,
                private readonly batchingDelayMs: number,
                private readonly logger: Logger) {
        this.queuedCandidates = {};
        this.deliveryPromises = {};
    }

    on(eventType: string, handler: Function): void {
        this.signallingService.on(eventType, handler);
    }

    removeAllListeners(eventType?: string): void {
        this.signallingService.removeAllListeners(eventType);
    }

    connect(metadataProviders: { [key: string]: MetadataProvider }, rooms: string[]): void {
        this.signallingService.connect(metadataProviders, rooms);
    }

    sendOffer(destinationNode: WebRTCCyclonNodePointer, type: string, sessionDescription: RTCSessionDescriptionInit): Promise<number> {
        return this.signallingService.sendOffer(destinationNode, type, sessionDescription);
    }

    waitForAnswer(correlationId: number): Promise<AnswerMessage> {
        return this.signallingService.waitForAnswer(correlationId);
    }

    createNewPointer(): WebRTCCyclonNodePointer {
        return this.signallingService.createNewPointer();
    }

    getLocalId(): string {
        return this.signallingService.getLocalId();
    }

    sendAnswer(destinationNode: WebRTCCyclonNodePointer, correlationId: number, sessionDescription: RTCSessionDescriptionInit): Promise<void> {
        return this.signallingService.sendAnswer(destinationNode, correlationId, sessionDescription);
    }

    sendIceCandidates(destinationNode: WebRTCCyclonNodePointer, correlationId: number, iceCandidates: RTCIceCandidate[]) {
        let newQueue = iceCandidates;
        const existingQueue = this.getQueue(destinationNode.id, correlationId);
        if (existingQueue) {
            newQueue = existingQueue.concat(iceCandidates);
        }
        else {
            // This is the first set of candidates to be queued for the destination/correlationId combo, schedule their delivery
            this.setPromise(destinationNode.id, correlationId, this.scheduleCandidateDelivery(destinationNode, correlationId));
        }
        this.setQueue(destinationNode.id, correlationId, newQueue);
        return this.getPromise(destinationNode.id, correlationId);
    };

    private getPromise(destinationNodeId: string, correlationId: number) {
        if (this.deliveryPromises.hasOwnProperty(destinationNodeId) && this.deliveryPromises[destinationNodeId].hasOwnProperty(correlationId)) {
            return this.deliveryPromises[destinationNodeId][correlationId];
        }
        else {
            throw new Error("Couldn't locate promise for send?! (this should never happen)");
        }
    }

    private setPromise(nodeId: string, correlationId: number, newPromise: Promise<any>) {
        if (!this.deliveryPromises.hasOwnProperty(nodeId)) {
            this.deliveryPromises[nodeId] = {};
        }
        this.deliveryPromises[nodeId][correlationId] = newPromise;
    }

    private deletePromise(nodeId: string, correlationId: number): void {
        delete this.deliveryPromises[nodeId][correlationId];
        if (Object.keys(this.deliveryPromises[nodeId]).length === 0) {
            delete this.deliveryPromises[nodeId];
        }
    }

    private getQueue(nodeId: string, correlationId: number): RTCIceCandidate[] | null {
        if (this.queuedCandidates.hasOwnProperty(nodeId) && this.queuedCandidates[nodeId].hasOwnProperty(correlationId)) {
            return this.queuedCandidates[nodeId][correlationId];
        }
        return null;
    }

    private setQueue(nodeId: string, correlationId: number, newQueue: RTCIceCandidate[]) {
        if (!this.queuedCandidates.hasOwnProperty(nodeId)) {
            this.queuedCandidates[nodeId] = {};
        }
        this.queuedCandidates[nodeId][correlationId] = newQueue;
    }

    private deleteQueue(nodeId: string, correlationId: number) {
        delete this.queuedCandidates[nodeId][correlationId];
        if (Object.keys(this.queuedCandidates[nodeId]).length === 0) {
            delete this.queuedCandidates[nodeId];
        }
    }

    private scheduleCandidateDelivery(destinationNode: WebRTCCyclonNodePointer, correlationId: number) {
        return new Promise((resolve, reject) => {
            this.asyncExecService.setTimeout(() => {
                const queueToSend = this.getQueue(destinationNode.id, correlationId);
                if (queueToSend) {
                    this.deleteQueue(destinationNode.id, correlationId);
                    this.deletePromise(destinationNode.id, correlationId);
                    this.signallingService.sendIceCandidates(destinationNode, correlationId, queueToSend)
                        .then(resolve, reject);
                } else {
                    this.logger.warn('ICE candidate queue to send was empty')
                }
            }, this.batchingDelayMs);
        });
    }
}
