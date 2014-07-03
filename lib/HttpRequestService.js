'use strict';

var Promise = require("bluebird");

/**
 * Just sends HTTP requests and handles the responses
 * assumes content being received is JSON
 *
 * Success code for GET is 200, success code for POST is 201
 */
function HttpRequestService() {

    this.get = function (url) {

        var req = new XMLHttpRequest();
        return new Promise(function (resolve, reject) {
            req.open("GET", url);

            req.onload = function () {
                cleanupListeners(req);
                if (req.status === 200) {
                    if (req.getResponseHeader("Content-Type").indexOf("application/json") === 0) {
                        resolve(JSON.parse(req.responseText));
                    }
                    else {
                        resolve(req.responseText);
                    }
                }
                else {
                    reject(new Error(req.statusText));
                }
            };

            req.onerror = function () {
                cleanupListeners(req);
                reject(new Error("Network Error"));
            };

            req.send();
        }).cancellable().catch(Promise.CancellationError, function (e) {
                req.abort();
                cleanupListeners(req);
                throw e;
            });
    };


    this.post = function (url, contents) {

        var req = new XMLHttpRequest();
        return new Promise(function (resolve, reject) {
            req.open("POST", url);
            req.setRequestHeader("Content-Type", "application/json");

            req.onload = function () {
                cleanupListeners(req);
                if (req.status === 201) {
                    if (req.getResponseHeader("Content-Type").indexOf("application/json") === 0) {
                        resolve(JSON.parse(req.responseText));
                    }
                    else {
                        resolve(req.responseText);
                    }
                }
                else {
                    reject(new Error(req.statusText));
                }
            };

            req.onerror = function () {
                cleanupListeners(req);
                reject(new Error("Network Error"));
            };

            req.send(JSON.stringify(contents));
        }).cancellable().catch(Promise.CancellationError, function (e) {
                req.abort();
                cleanupListeners(req);
                throw e;
            });
    };
}

function cleanupListeners(request) {
    request.onerror = null;
    request.onload = null;
}

module.exports = HttpRequestService;