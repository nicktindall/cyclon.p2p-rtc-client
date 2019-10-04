import {SignallingServerService} from "./SignallingServerService";
import {TimingService} from "./TimingService";
import {SignallingServerSpec} from "./SignallingServerSpec";

const LAST_CONNECTED_SERVERS_KEY = "CyclonJSLastConnectedServerList";
const ANCIENT_TIMESTAMP_MILLISECONDS_SINCE_EPOCH = new Date("October 6, 1980 02:20:00").getTime();

export class SignallingServerSelector {

    private readonly randomSortValues: any;
    private readonly lastDisconnectTimes: any;

    constructor(private readonly signallingServerService: SignallingServerService,
                private readonly storage: Storage,
                private readonly timingService: TimingService,
                private readonly delayBeforeRetryMilliseconds: number) {
        this.randomSortValues = {};
        this.lastDisconnectTimes = {};
    }

    getServerSpecsInPriorityOrder(): SignallingServerSpec[] {
        return this.filterAndSortAvailableServers(this.signallingServerService.getSignallingServerSpecs());
    }

    /**
     * Return a copy of the known server array sorted in the order of
     * their last-disconnect-time. Due to the fact a failed connect is
     * considered a disconnect, this will cause servers to be tried in
     * a round robin pattern.
     */
    private filterAndSortAvailableServers(serverArray: SignallingServerSpec[]): SignallingServerSpec[] {
        const copyOfServerArray: SignallingServerSpec[] = JSON.parse(JSON.stringify(serverArray));
        copyOfServerArray.sort((itemOne: SignallingServerSpec, itemTwo: SignallingServerSpec) => {
            return this.sortValue(itemOne) - this.sortValue(itemTwo);
        });

        // Filter servers we've too-recently disconnected from
        return copyOfServerArray.filter((val: SignallingServerSpec) => this.haveNotDisconnectedFromRecently(val));
    }

    private haveNotDisconnectedFromRecently(signallingServer: SignallingServerSpec) {
        const lastDisconnectTime = this.lastDisconnectTimes[signallingServer.signallingApiBase];
        return lastDisconnectTime === undefined ||
            this.timingService.getCurrentTimeInMilliseconds() - lastDisconnectTime > this.delayBeforeRetryMilliseconds;
    }

    /**
     * Return the value to be used in the ascending sort of
     * server specs. It will use the last disconnect time if it's
     * present, or a random number guaranteed to be prior to the
     * earliest disconnect time, to randomise the order servers are
     * tried initially.
     *
     * @param serverSpec
     */
    private sortValue(serverSpec: SignallingServerSpec): number {
        const signallingApiBase = serverSpec.signallingApiBase;
        return this.lastDisconnectTimes[signallingApiBase] || this.getRandomSortValue(signallingApiBase);
    }

    /**
     * Generate a CONSISTENT (for a given signallingApiBase) random timestamp well in the past
     */
    private getRandomSortValue (signallingApiBase: string) {
        let value;

        // Prefer servers we were connected to before a reload
        if (this.getLastConnectedServers().indexOf(signallingApiBase) >= 0) {
            return 0;
        }

        if (this.randomSortValues.hasOwnProperty(signallingApiBase)) {
            value = this.randomSortValues[signallingApiBase];
        }
        else {
            value = this.randomSortValues[signallingApiBase] = Math.floor(Math.random() * ANCIENT_TIMESTAMP_MILLISECONDS_SINCE_EPOCH);
        }
        return value;
    }

    flagDisconnection(apiBase: string) {
        this.lastDisconnectTimes[apiBase] = this.timingService.getCurrentTimeInMilliseconds()
    }

    /**
     * Store the last connected signalling servers so they can be
     * re-connected to on a reload
     */
    setLastConnectedServers (apiUrls: string[]) {
        this.storage.setItem(LAST_CONNECTED_SERVERS_KEY, JSON.stringify(apiUrls));
    }

    /**
     * Gets the list of last connected servers (if available) from
     * session storage
     *
     * @returns {*}
     */
    getLastConnectedServers () {
        const storedValue = this.storage.getItem(LAST_CONNECTED_SERVERS_KEY);
        return storedValue ? JSON.parse(storedValue) : [];
    }
}
