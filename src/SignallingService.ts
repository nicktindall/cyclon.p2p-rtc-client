import {MetadataProvider} from 'cyclon.p2p';
import {WebRTCCyclonNodePointer} from "./WebRTCCyclonNodePointer";

export interface SignallingService {

    on(eventType: string, handler: Function): void;

    removeAllListeners(eventType?: string): void;

    connect(sessionMetadataProviders: { [key: string]: MetadataProvider }, rooms: string[]): void;

    sendOffer(destinationNode: WebRTCCyclonNodePointer, type: string, sessionDescription: RTCSessionDescriptionInit): Promise<number>;

    waitForAnswer(correlationId: number): Promise<AnswerMessage>;

    createNewPointer(): WebRTCCyclonNodePointer;

    getLocalId(): string;

    sendAnswer(destinationNode: WebRTCCyclonNodePointer, correlationId: number, sessionDescription: RTCSessionDescriptionInit): Promise<void>;

    sendIceCandidates(destinationNode: WebRTCCyclonNodePointer, correlationId: number, iceCandidates: RTCIceCandidate[]): Promise<void>;
}

export interface SignallingMessage {
    sourceId: string;
    correlationId: number;
}

export interface AnswerMessage extends SignallingMessage {
    sessionDescription: RTCSessionDescriptionInit;
}

export interface OfferMessage extends SignallingMessage {
    channelType: string;
    sourcePointer: WebRTCCyclonNodePointer;
    sessionDescription: RTCSessionDescriptionInit;
}

export interface IceCandidatesMessage extends SignallingMessage {
    iceCandidates: RTCIceCandidateInit[];
}
