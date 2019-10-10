const {consoleLogger, newInMemoryStorage} = require('cyclon.p2p-common');
const {Builder} = require('../lib/Builder');

describe('The RTC builder', () => {

    it('Should build an RTC and a signallingSocket', () => {
        let result = new Builder().build();
        expect(result.rtc).toBeDefined();
        expect(result.signallingSocket).toBeDefined();
    });

    it('should return the same rtc and signalling socket when called multiple times', () => {
        let builder = new Builder();
        let result1 = builder.build();
        let result2 = builder.build();
        expect(result1).toBe(result2);
    });

    it('should allow setting of logger', () => {
        expect(new Builder().withLogger(consoleLogger()).build()).toBeDefined();
    });

    it('should allow setting of storage', () => {
        expect(new Builder().withStorage(newInMemoryStorage()).build()).toBeDefined();
    });

    it('should allow setting of signalling servers', () => {
       expect(new Builder().withSignallingServers([]).build()).toBeDefined();
    });

    it('should allow setting of signalling server reconnect delay', () => {
        expect(new Builder().withSignallingServerReconnectDelay(1000).build()).toBeDefined();
    });

    it('should allow setting of ice servers', () => {
        expect(new Builder().withIceServers([]).build()).toBeDefined();
    });

    it('should allow setting of channel state change timeout', () => {
        expect(new Builder().withChannelStateChangeTimeout(1000).build()).toBeDefined();
    });
});