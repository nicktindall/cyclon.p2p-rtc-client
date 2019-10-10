import {SignallingServerSpec} from './SignallingServerSpec';

const DEFAULT_BATCHING_DELAY_MS: number = 300;
const DEFAULT_SIGNALLING_SERVERS: SignallingServerSpec[] = [
    {
        'socket': {
            'server': 'http://cyclon-js-ss-one.herokuapp.com:80'
        },
        'signallingApiBase': 'http://cyclon-js-ss-one.herokuapp.com:80'
    },
    {
        'socket': {
            'server': 'http://cyclon-js-ss-two.herokuapp.com:80'
        },
        'signallingApiBase': 'http://cyclon-js-ss-two.herokuapp.com:80'
    },
    {
        'socket': {
            'server': 'http://cyclon-js-ss-three.herokuapp.com:80'
        },
        'signallingApiBase': 'http://cyclon-js-ss-three.herokuapp.com:80'
    }
];
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    // The public Google STUN server
    {urls: ['stun:stun.l.google.com:19302']},
];
const DEFAULT_CHANNEL_STATE_TIMEOUT_MS: number = 30000;
const DEFAULT_SIGNALLING_SERVER_RECONNECT_DELAY_MS: number = 5000;

export {
    DEFAULT_BATCHING_DELAY_MS,
    DEFAULT_ICE_SERVERS,
    DEFAULT_CHANNEL_STATE_TIMEOUT_MS,
    DEFAULT_SIGNALLING_SERVER_RECONNECT_DELAY_MS,
    DEFAULT_SIGNALLING_SERVERS
}