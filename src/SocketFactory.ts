'use strict';

import {SignallingServerSpec} from "./SignallingServerSpec";

import io from 'socket.io-client';
import url from 'url';

export class SocketFactory {

    /**
     * Create a socket
     */
    createSocket = function (serverSpec: SignallingServerSpec): SocketIOClient.Socket {
        //noinspection JSCheckFunctionSignatures
        return io(url.resolve(serverSpec.socket.server, "/peers"), createOptionsForServerSpec(serverSpec));
    };
}

/**
 * Create the socket.io options for the specified server
 */
function createOptionsForServerSpec(serverSpec: SignallingServerSpec): SocketIOClient.ConnectOpts {
    const options: SocketIOClient.ConnectOpts = {
        forceNew: true,            // Make a new connection each time
        reconnection: false        // Don't try and reconnect automatically
    };

    // If the server spec contains a socketResource setting we use
    // that otherwise leave the default ('/socket.io/')
    if(serverSpec.socket.socketResource) {
        // @ts-ignore ; we're using a version of socket.io older than the types, TODO upgrade to a version with types
        options.resource = serverSpec.socket.socketResource;
    }
    return options;
}
