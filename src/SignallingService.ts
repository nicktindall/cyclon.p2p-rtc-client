import {MetadataProvider, CyclonNodePointer} from "cyclon.p2p";

export interface SignallingService {

    on(eventType: string, handler: Function): void;

    removeAllListeners(eventType: string): void;

    connect(sessionMetadataProviders: { [key: string]: MetadataProvider }, rooms: string[]): void;

    sendOffer(destinationNode: CyclonNodePointer, type: string, sessionDescription: RTCSessionDescription): Promise<number>;

    waitForAnswer(correlationId: number): Promise<any>;

    createNewPointer(): CyclonNodePointer;

    getLocalId(): string;

    sendAnswer(destinationNode: string, correlationId: number, sessionDescription: RTCSessionDescription): Promise<void>;

    sendIceCandidates(destinationNode: string, correlationId: number, iceCandidates: RTCIceCandidate[]): Promise<void>;
}