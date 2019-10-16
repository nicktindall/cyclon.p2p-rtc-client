import {EventEmitter} from 'events';
import {Logger, timeLimitedPromise} from 'cyclon.p2p-common';
import {RTCObjectFactory} from './RTCObjectFactory';
import {AnswerMessage} from './SignallingService';

export class PeerConnection extends EventEmitter {

    private localIceCandidates: RTCIceCandidate[] = [];
    private storedIceCandidates: { [serialized: string]: boolean } = {};
    private rtcDataChannel?: RTCDataChannel;
    private localDescription?: RTCSessionDescriptionInit;
    private emittingIceCandidates: boolean = false;
    private remoteDescription?: RTCSessionDescription;
    private remoteDescriptionSet: boolean = false;
    private remoteIceCandidateCache: RTCIceCandidateInit[] = [];

    constructor(private rtcPeerConnection: RTCPeerConnection,
                private readonly rtcObjectFactory: RTCObjectFactory,
                private readonly logger: Logger,
                private readonly channelStateTimeoutMs: number) {
        super();

        //
        // Always be listening for ICE candidates
        //
        rtcPeerConnection.onicecandidate = (candidate: RTCPeerConnectionIceEvent) => {
            this.addLocalIceCandidate(candidate);
        };

        //
        // Handle the case where we get a data channel before we're listening for it
        //
        rtcPeerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
            this.rtcDataChannel = event.channel;
            this.emit('channelCreated', event.channel);
        };
    }

    /**
     * Create an offer then resolve with the local session description
     *
     * @returns {Promise}
     */
    async createOffer(): Promise<RTCSessionDescriptionInit> {
        //
        // Create the data channel
        //
        this.rtcDataChannel = this.rtcPeerConnection.createDataChannel('cyclonShuffleChannel');
        this.emit('channelCreated', this.rtcDataChannel);

        //
        // Create an offer, wait for ICE candidates
        //
        const offerOptions: RTCOfferOptions = {
            offerToReceiveAudio: false,     // see https://code.google.com/p/webrtc/issues/detail?id=2108
            offerToReceiveVideo: false
        };
        this.localDescription = await this.rtcPeerConnection.createOffer(offerOptions);
        await this.rtcPeerConnection.setLocalDescription(this.localDescription);
        return this.localDescription;
    }

    /**
     * Create an answer then store and set the local session description
     *
     * @param remoteDescription
     * @returns {Promise}
     */
    async createAnswer(remoteDescription: RTCSessionDescriptionInit): Promise<void> {
        await this.rtcPeerConnection.setRemoteDescription(this.rtcObjectFactory.createRTCSessionDescription(remoteDescription));

        // Process any ICE candidates that arrived before the description was set
        this.remoteDescriptionSet = true;
        this.processRemoteIceCandidates([]);
        this.localDescription = await this.rtcPeerConnection.createAnswer();
        await this.rtcPeerConnection.setLocalDescription(this.localDescription);
    }

    /**
     * Process some remote ICE candidates
     */
    async processRemoteIceCandidates(remoteIceCandidates: RTCIceCandidateInit[]): Promise<void> {
        this.remoteIceCandidateCache = this.remoteIceCandidateCache.concat(remoteIceCandidates);
        if (this.remoteDescriptionSet) {
            await Promise.all(this.remoteIceCandidateCache.map(async (iceCandidate: RTCIceCandidateInit) => {
                this.logger.debug(`Adding remote ICE candidate: ${iceCandidate.candidate}`);
                await this.rtcPeerConnection.addIceCandidate(this.rtcObjectFactory.createRTCIceCandidate(iceCandidate));
            }));
            this.remoteIceCandidateCache = [];
        }
    }

    /**
     * Start emitting gathered ICE candidates as events
     */
    startEmittingIceCandidates(): void {
        this.emittingIceCandidates = true;
        this.addLocalIceCandidate(null);
    }

    /**
     * Wait for the data channel to open then resolve with it
     *
     * @returns {Promise}
     */
    async waitForChannelToOpen(): Promise<RTCDataChannel> {
        try {
            return await timeLimitedPromise(new Promise<RTCDataChannel>((resolve) => {

                const resolvedChannel: RTCDataChannel = this.rtcDataChannel as RTCDataChannel;
                if (resolvedChannel.readyState === 'open') {
                    resolve(this.rtcDataChannel);
                } else if (typeof (resolvedChannel.readyState) === 'undefined' || resolvedChannel.readyState === 'connecting') {
                    resolvedChannel.onopen = function () {
                        resolvedChannel.onopen = null;
                        resolve(resolvedChannel);
                    };
                } else {
                    throw new Error(`Data channel was in illegal state: ${resolvedChannel.readyState}`);
                }
            }), this.channelStateTimeoutMs, 'Channel opening timeout exceeded');
        } finally {
            (this.rtcDataChannel as RTCDataChannel).onopen = null;
        }
    }

    /**
     * Handle the answer received then set and store the remote session description
     *
     * @returns {Promise}
     */
    async handleAnswer(answerMessage: AnswerMessage): Promise<void> {
        const remoteDescription = answerMessage.sessionDescription;
        await this.rtcPeerConnection.setRemoteDescription(this.rtcObjectFactory.createRTCSessionDescription(remoteDescription));
        this.remoteDescriptionSet = true;
        await this.processRemoteIceCandidates([]);
    }

    getLocalIceCandidates(): RTCIceCandidate[] {
        return this.localIceCandidates;
    }

    getLocalDescription(): RTCSessionDescriptionInit {
        if (!this.localDescription) {
            throw new Error('Local description is not yet set!');
        }
        return this.localDescription;
    };

    /**
     * Close the data channel & connection
     */
    close(): void {
        if (this.rtcPeerConnection) {
            this.rtcPeerConnection.ondatachannel = null;
            this.rtcPeerConnection.onicecandidate = null;
            if (this.rtcDataChannel !== undefined) {
                this.rtcDataChannel.onopen = null;
                this.rtcDataChannel.onmessage = null;
                this.rtcDataChannel.onerror = null;
                this.rtcDataChannel.onclose = null;
                this.rtcDataChannel.close();
                delete this.rtcDataChannel;
            }
            this.rtcPeerConnection.close();
            delete this.rtcPeerConnection;
        }

        delete this.localIceCandidates;
        delete this.storedIceCandidates;
        delete this.remoteDescription;
    };

    /**
     * An ICE candidate was received
     *
     * @param event
     */
    private addLocalIceCandidate(event: RTCPeerConnectionIceEvent | null): void {
        if (event && event.candidate) {
            // Add the ICE candidate only if we haven't already seen it
            const serializedCandidate = JSON.stringify(event.candidate);
            if (!this.storedIceCandidates.hasOwnProperty(serializedCandidate)) {
                this.storedIceCandidates[serializedCandidate] = true;
                this.localIceCandidates.push(event.candidate);
            }
        }

        // Emit an iceCandidates event containing all the candidates
        // gathered since the last event if we are emitting
        if (this.emittingIceCandidates && this.localIceCandidates.length > 0) {
            this.emit('iceCandidates', this.localIceCandidates);
            this.localIceCandidates = [];
        }
    }
}

