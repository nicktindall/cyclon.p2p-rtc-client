'use strict';

var http = require("http");
var url = require("url");
var Promise = require("bluebird");
var Agent = require('agentkeepalive');

var keepaliveAgent = new Agent({
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    keepAliveTimeout: 60000
});

function NodeHttpRequestService() {

    this.get = function (requestUrl) {

        var req = null;
        var responded = false;

        return new Promise(function (resolve, reject) {
            req = http.get(requestUrl, function(res) {
                if(res.statusCode === 200) {
                    res.on("data", function(chunk) {
                        if(responded) {
                            throw new Error("Already responded");
                        }
                        responded = true;

                        if(res.headers["content-type"].indexOf("application/json") > 0) {
                            resolve(JSON.parse(chunk));
                        }
                        else {
                            resolve(chunk);
                        }
                    });
                    res.once("end", function() {
                        res.removeAllListeners("data");
                    });
                }
                else {
                    reject(new Error(res.statusCode));
                }
            });
        })
        .cancellable().catch(Promise.CancellationError, function (e) {
            req.abort();
            throw e;
        });
    };

    this.post = function (requestUrl, contents) {

        var parsedUrl = url.parse(requestUrl);
        var contentString = JSON.stringify(contents);
        var req = null;
        var responded = false;

        return new Promise(function (resolve, reject) {
            var options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname,
                method: 'POST',
                headers: {
                    "Content-Type" : "application/json",
                    "Content-Length" : contentString.length
                },
                agent: keepaliveAgent
            };
            req = http.request(options, function(res) {
                if(res.statusCode === 201) {
                    res.on("data", function(chunk) {
                        if(responded) {
                            throw new Error("Already responded");
                        }
                        responded = true;

                        if(res.headers["content-type"].indexOf("application/json") > 0) {
                            resolve(JSON.parse(chunk));
                        }
                        else {
                            resolve(chunk);
                        }
                    });
                    res.once("end", function() {
                        res.removeAllListeners("data");
                    });
                }
                else {
                    reject(new Error(res.statusCode));
                }
            });

            req.write(JSON.stringify(contents));
            req.end();
        })
        .cancellable().catch(Promise.CancellationError, function (e) {
            req.abort();
            throw e;
        });
    };
}

module.exports = NodeHttpRequestService;
