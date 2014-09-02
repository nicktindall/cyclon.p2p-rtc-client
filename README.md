cyclon.p2p-rtc - A WebRTC abstraction layer
===========================================

[![Build Status](https://travis-ci.org/nicktindall/cyclon.p2p-rtc-client.svg?branch=master)](https://travis-ci.org/nicktindall/cyclon.p2p-rtc-client)

The client-side component of a simple WebRTC abstraction layer.

Written for use by the cyclon.p2p WebRTC communications module this abstraction features a simple API for establishing WebRTC data channels and sending and receiving data over them.

Signalling Server Redundancy
----------------------------

The client listens on multiple signalling servers using WebSockets for the offer and answer messages. By listening to multiple signalling servers, signalling server redundancy and hence a degree of fault tolerance is achieved. The client will retrieve a list of available signalling servers from the SignallingServerService and connect to the number of them specified by the same.

If disconnection from one of the current signalling servers is detected, another random server is chosen from the set available (again retreived from the SignallingServerService). If the only other servers available are servers the client has previously been disconnected from the client will prefer those least-recently disconnected from.

CORS is utilised to allow nodes to connect to signalling servers not of the same origin as the page which serves up the client.

The set of signalling servers the client is currently connected to is made available via the getSignallingInfo() method. This will return a list of server specifications, which includes the base URL of the server's REST API which is used to send offers and answers to clients connected to it. This list is communicated to other nodes to provide them with a way of initiating an offer/answer exchange. When attempting to send an offer or answer to a remote node, clients try each of the signalling servers in random order (a crude attempt at load balancing) until one returns a 201 indicating the message has been delivered or all have been attempted unsuccessfully.

Signalling Server Affinity
--------------------------

The client takes an implementation of the DOM storage API as a parameter which it will use to store the current set of signalling servers each time the set changes. When choosing signalling servers for the initial set this storage will be queried and any signalling servers stored in it will be preferred if present in the list provided by the SignallingServerService. In this way it is possible using, for example, the DOM `sessionStorage` object in a browser to reconnect to the same signalling servers the client was connected to after a page refresh. This has the benefit that pointers to the node which are 'in the wild' will remain valid for longer.

The Signalling Server REST API
------------------------------

The signalling server REST API is the means by which nodes send offers and answers to other nodes.

Nodes communicate with each other 'pointers' to themselves and potentially other nodes they are aware of. The pointers contain the details of signalling server(s) the node are connected to which include the base URL of the following REST API. All endpoints mentioned are relative to this base URL.

./offer : This is where offers are sent, a POST is submitted containing the following JSON blob in its body;

	{
		channelType: (String)
			The type of channel being offered

		sourceId: (String)
			The ID of the source node

		correlationId: (Number)
			The correlation ID which should be attached to the answer to this offer

		sourcePointer: (Object)
			The full node pointer to the source node

		destinationId: (String)
			The ID of the destination node, used by the signalling server to route the message

		sessionDescription: (Object)
        	The serialized RTCSessionDescription object

		iceCandidates: (A list of Objects)
        	The list of serialized RTCIcecandidate objects gathered
	}

	In response to an offer the signalling server will return;
	 * a 201 if the destination node is still connected and the offer has been delivered
	 * a 404 if the destination node is no longer connected and the offer could not be delivered

./answer : This is where answers are sent, a POST is submitted containing the following JSON blob in its body;
	
	{
		sourceId: (String)
			The ID of the source node

        correlationId: (Number)
        	The correlation ID of the offer which this answer is a reply to

        destinationId: (String)
        	The ID of the destination node

        sessionDescription: (Object)
        	The serialized RTCSessionDescription object

        iceCandidates: (a list of Objects)
        	The list of serialized RTCIcecandidate objects gathered
	}

	As with the offer, responses are as follows;
	* a 201 if the destination node is still connected to this server and the answer was delivered
	* a 404 if the destination node is no longer connected to this signalling server so the answer could not be delivered

The Client API
--------------

** TODO **


