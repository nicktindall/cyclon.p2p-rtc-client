cyclon.p2p-rtc - A WebRTC abstraction layer
===========================================

[![Build Status](https://travis-ci.org/nicktindall/cyclon.p2p-rtc-client.svg?branch=master)](https://travis-ci.org/nicktindall/cyclon.p2p-rtc-client)
[![Dependencies](https://david-dm.org/nicktindall/cyclon.p2p-rtc-client.png)](https://david-dm.org/nicktindall/cyclon.p2p-rtc-client)

The client-side component of a simple WebRTC abstraction layer.

Written for use by the cyclon.p2p WebRTC communications module this abstraction features a simple API for establishing WebRTC data channels and sending and receiving data over them.

How to use
----------
First install cyclon-rtc-client as a runtime dependency using npm

```
npm install cyclon-rtc-client --save
```

If you are using browserify and AngularJS in your project you can include the "cyclon-rtc" service simply:

```
var cyclonRtc = require('cyclon-rtc-client');
var angular = require('angular');  // or wherever angular comes from

// Create the 'cyclon-rtc' module
cyclonRtc.createAngularModule(angular);

// Then any modules that depend on 'cyclon-rtc' can use the 'RTC' service exposed
var myModule = angular.module('myModule', ['cyclon-rtc'])
myModule.service('myService', ['RTC', function(rtcClient) {
    ...
  }]);
  
```

The RTC API
-----------
The API for the RTC service exposed is as follows:

connect(metadataProviders, rooms):
    This will connect to the signalling servers configured and make the client ready to send and receive requests to other peers.
    
    Parameters:
    * metadataProviders: a hash of names to functions that return values which will be included in the node pointers created by the RTC client.
    * rooms: An array of 'room' names that the client wishes to join. Joining a room means the client's pointer will be a candidate to be returned by the signalling server's ./api/peers?room=RoomName endpoint.
    
createNewPointer():
    Returns a new 'node pointer' to the local client, this can be sent to other clients who will be able to use it to establish a connection.
    
getLocalId():
    Get the UUID of the local RTC client.
    
onChannel(type, callback):
    Add an action to perform upon the establishment of a new incoming channel of a particular type.
    
    Parameters:
    * type: A string which uniquely identifies the type of channel to respond to
    * callback: A function which will be invoked with a single parameter, the Channel object when an inbound channel of the specified type is established. It is the application's responsibility to close the Channel when the exchange is completed, a failure to do so will lead to memory leaks.
        
openChannel(type, remotePointer):
    Open a channel of a particular type to a remote peer
    
    Parameters:
    * type: A string which uniquely identifies the type of channel to open
    * remotePeer: The 'node pointer' of the remote peer to connect to. The remote peer can get this by calling createNewPointer() on its client and transmitting the pointer to the node peer wishing to connect.
        
Configuration
-------------
By default the module created will use:
* Three demonstration signalling servers deployed on Heroku. These should be used for evaluation purposes only as their availability is not guaranteed, and they are shared between anyone that uses this library with the default settings.
* The 'public' STUN server provided by Google. Again, for any serious deployment users should deploy their own STUN and/or TURN servers. The Google STUN server probably cannot be relied upon to be there and freely available forever.

You can change these defaults by specifying configuration values on the modules that are created. e.g.

```
rtc.buildAngularModule(angular)
    .value('IceServers', [
        // Our corporate TURN server 
        {urls: ['turn:51.11.11.22'], username: 'specialUser', credential: 'topSecret'}
    ])
    .value('SignallingServers', JSON.parse([
        // Our corporate signalling server instance
        {
            'socket': {
                'server': 'http://signalling.mycompany.com'
            },
            'signallingApiBase': 'http://signalling.mycompany.com'
        }
    ]));
```

You can also override many of the services specified in the modules if you feel like tinkering, check out the `buildAngularModule()` function in lib/index.js file for more details.

Signalling Servers
------------------
Check out the corresponding signalling server project at https://github.com/nicktindall/cyclon.p2p-rtc-server if you would like to run your own signalling servers. The whole signalling infrastructure is abstracted so you could also implement your own and use that instead. See `lib/SocketIOSignallingServer.js` for the interface expected.



