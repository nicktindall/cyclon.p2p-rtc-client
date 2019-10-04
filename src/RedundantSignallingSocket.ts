import EventEmitter from 'events';
import {AsyncExecService, Logger} from "cyclon.p2p-common";
import {SignallingServerService} from "./SignallingServerService";
import {SignallingSocket} from "./SignallingSocket";
import {AnswerMessage, IceCandidatesMessage, OfferMessage, SignallingService} from "./SignallingService";
import {SocketFactory} from "./SocketFactory";
import {SignallingServerSpec} from "./SignallingServerSpec";

const INTERVAL_BETWEEN_SERVER_CONNECTIVITY_CHECKS = 30 * 1000;

/**
 * Maintains connections to up to a specified number of signalling servers
 * via socket.io and emits signalling messages received on them
 *
 * @param signallingServerService
 * @param loggingService
 * @param socketFactory
 * @param asyncExecService
 * @param signallingServerSelector
 * @constructor
 */
export class RedundantSignallingSocket extends EventEmitter implements SignallingSocket  {

    private readonly connectedSockets: { [signallingApiBase: string]: SocketIOClient.Socket };
    private readonly connectedSpecs: { [signallingApiBase: string]: SignallingServerSpec };
    private connectivityIntervalId?: number;
    private unloadInProgress: boolean;
    private signallingService?: SignallingService;
    private rooms: string[];

    constructor(private readonly signallingServerService: SignallingServerService,
                private readonly socketFactory: SocketFactory,
                private readonly logger: Logger,
                private readonly asyncExecService: AsyncExecService,
                private readonly signallingServerSelector: any) {
        super();
        this.connectedSockets = {};
        this.connectedSpecs = {};
        this.unloadInProgress = false;
        this.rooms = [];

        // If we're in a window, watch for unloads so we can disable
        // attempting to reconnect (and losing affinity with our previous signalling servers)
        if (typeof (window) !== "undefined") {
            window.addEventListener("beforeunload", () => {
                this.unloadInProgress = true;
            });
        }

        // We should only ever have one answer, and one offer listener
        this.setMaxListeners(2);
    }


    /**
     * Connect to signalling servers
     */
    connect(localSignallingService: SignallingService, roomsToJoin: string[]) {
        this.signallingService = localSignallingService;
        this.rooms = roomsToJoin;
        this.connectAndMonitor();
    }

    /**
     * Schedule periodic server connectivity checks
     */
    private scheduleServerConnectivityChecks() {
        if (this.connectivityIntervalId === undefined) {
            this.connectivityIntervalId = this.asyncExecService.setInterval(() => {
                this.updateRegistrations();
                this.connectToServers();
            }, INTERVAL_BETWEEN_SERVER_CONNECTIVITY_CHECKS);
        }
        else {
            throw new Error("BUG ::: Attempt was made to start connectivity checks twice");
        }
    }

    /**
     * Update our registrations with the servers
     * we're connected to
     */
    private updateRegistrations(): void {
        for (const key in this.connectedSockets) {
            this.sendRegisterMessage(this.connectedSockets[key]);
        }
    }

    /**
     * Stop periodic connectivity checks
     */
    private stopConnectivityChecks(): void {
        if (this.connectivityIntervalId !== undefined) {
            this.asyncExecService.clearInterval(this.connectivityIntervalId);
            delete this.connectivityIntervalId;
        }
    }

    private connectAndMonitor(): void {
        this.connectToServers();
        this.scheduleServerConnectivityChecks();
    }

    /**
     * Get the list of server specs we're currently listening on
     *
     * @returns {Array}
     */
    getCurrentServerSpecs(): SignallingServerSpec[] {
        const specs = [];
        for (const spec in this.connectedSpecs) {
            specs.push(this.connectedSpecs[spec]);
        }
        return specs;
    }

    /**
     * Connect to servers if we're not connected to enough
     */
    private connectToServers(): void {
        const knownServers = this.signallingServerSelector.getServerSpecsInPriorityOrder();

        for (let i = 0; i < knownServers.length; i++) {
            const connectionsRemaining = this.signallingServerService.getPreferredNumberOfSockets() - Object.keys(this.connectedSockets).length;

            //
            // We have enough connections
            //
            if (connectionsRemaining === 0) {
                break;
            }

            //
            // Try to connect to a new server
            //
            const serverSpec = knownServers[i];
            if (!this.currentlyConnectedToServer(serverSpec)) {
                let socket;
                try {
                    socket = this.socketFactory.createSocket(serverSpec);
                    this.storeSocket(serverSpec, socket);
                    this.addListeners(socket, serverSpec);
                    this.logger.info(`Attempting to connect to signalling server (${serverSpec.signallingApiBase})`);
                }
                catch (error) {
                    this.logger.error(`Error connecting to socket ${serverSpec.signallingApiBase}`, error);
                }
            }
        }

        //
        // Store the new set of connected servers in session storage so we
        // can prefer them in the event of a reload
        //
        this.signallingServerSelector.setLastConnectedServers(this.getListOfCurrentSignallingApiBases());
    }

    /**
     * Are we currently connected to the specified server?
     *
     * @param serverSpec
     * @returns {boolean}
     */
    private currentlyConnectedToServer(serverSpec: SignallingServerSpec): boolean {
        return this.connectedSockets.hasOwnProperty(serverSpec.signallingApiBase);
    }

    /**
     * Return the list of signallingApiBase values for the current set
     * of signalling servers
     *
     * @returns {Array}
     */
    private getListOfCurrentSignallingApiBases(): string[] {
        return Object.keys(this.connectedSpecs);
    }

    /**
     * Delete a socket from the local store
     *
     * @param spec
     * @param socket
     */
    private storeSocket(spec: SignallingServerSpec, socket: SocketIOClient.Socket) {
        this.connectedSpecs[spec.signallingApiBase] = spec;
        this.connectedSockets[spec.signallingApiBase] = socket;
    }

    /**
     * Delete the socket from the local store
     *
     * @param apiBase
     */
    private deleteSocket(apiBase: string): void {
        delete this.connectedSpecs[apiBase];
        delete this.connectedSockets[apiBase];
        this.signallingServerSelector.flagDisconnection(apiBase);
    }

    /**
     * Add listeners for a socket
     *
     * @param socket
     * @param serverSpec
     */
    private addListeners(socket: SocketIOClient.Socket, serverSpec: SignallingServerSpec) {
        const apiBase = serverSpec.signallingApiBase;
        const disposeFunction = this.disposeOfSocket(apiBase);
        const registerFunction = this.register(socket);

        // Register if we connect
        socket.on("connect", registerFunction);

        // Dispose if we disconnect/fail to connect/error
        socket.io.on("connect_error", disposeFunction);
        socket.on("error", disposeFunction);
        socket.on("disconnect", disposeFunction);

        /**
         * Emit offers/answers when they're received
         */
        socket.on("answer", (answer: AnswerMessage) => {
            this.emitAnswer(answer);
        });
        socket.on("offer", (offer: OfferMessage) => {
            this.emitOffer(offer);
        });
        socket.on("candidates", (candidates: IceCandidatesMessage) => {
            this.emitCandidates(candidates);
        });
    }

    /**
     * Return a closure that will dispose of a socket
     *
     * @param apiBase
     * @returns {Function}
     */
    private disposeOfSocket(apiBase: string) {
        return (error: Error) => {
            this.logger.warn(`Got disconnected from signalling server (${apiBase})`, error);

            const socket = this.connectedSockets[apiBase];
            if (socket) {
                this.stopConnectivityChecks();
                socket.removeAllListeners();
                socket.io.removeAllListeners();
                try {
                    socket.disconnect();
                }
                catch (ignore) {
                }
                this.deleteSocket(apiBase);

                if (!this.unloadInProgress) {
                    this.connectAndMonitor();
                }
            }
            else {
                throw new Error("BUG ::: Disconnected from a socket we're not connected to?!");
            }
        };
    }

    /**
     * Tell the signalling server who we are
     *
     * @param socket
     * @returns {Function}
     */
    private register(socket: SocketIOClient.Socket) {
        return () => {
            this.sendRegisterMessage(socket);
            this.sendJoinRoomsMessage(socket);
        };
    }

    private sendRegisterMessage(socket: SocketIOClient.Socket) {
        socket.emit("register", (this.signallingService as SignallingService).createNewPointer());
    }

    private sendJoinRoomsMessage(socket: SocketIOClient.Socket) {
        socket.emit("join", this.rooms);
    }

    private emitAnswer(message: AnswerMessage) {
        this.emit("answer", message);
    }

    private emitOffer(message: OfferMessage) {
        this.emit("offer", message);
    }

    private emitCandidates(message: IceCandidatesMessage) {
        this.emit("candidates", message);
    }
}
