import http, {ClientRequest, IncomingMessage} from 'http';
import url  from 'url';
import {Promise} from 'bluebird';

export class HttpRequestService {

    post(requestUrl: string, contents: any): Promise<any> {
        return this.executeRequest('POST', requestUrl, contents, 201);
    }

    get(requestUrl: string): Promise<any> {
        return this.executeRequest('GET', requestUrl, null, 200);
    }

    private executeRequest(method: string, requestUrl: string, contents: any, expectedStatus: number): Promise<any> {
        const parsedUrl = url.parse(requestUrl);
        let contentString: string;
        if (contents) {
            contentString = JSON.stringify(contents);
        }
        let req: ClientRequest;

        return new Promise(function (resolve: Function, reject: Function) {
            const options = {
                withCredentials: false,
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: method
            } as any;

            if (contents) {
                options.headers = {
                    "Content-Type": "application/json",
                    "Content-Length": contentString.length
                }
            }

            req = http.request(options, function (res: IncomingMessage) {
                if (res.statusCode === expectedStatus) {
                    let responseContent: string = "";
                    res.on("data", function (chunk) {
                        responseContent += chunk;
                    });
                    res.once("end", function () {
                        res.removeAllListeners("data");
                        if (responseContentIsJson(res)) {
                            resolve(JSON.parse(responseContent));
                        }
                        else {
                            resolve(responseContent);
                        }
                    });
                }
                else {
                    reject(new Error(`Request failed, status code: ${res.statusCode}`));
                }
            });

            if (contents) {
                req.write(contentString);
            }
            req.end();
        }).cancellable().catch(Promise.CancellationError, function (e) {
            req.abort();
            throw e;
        });
    }
}

/**
 * Does this response contain JSON?
 *
 * @param response
 * @returns {boolean}
 */
function responseContentIsJson(response: IncomingMessage) {
    return response.headers["content-type"] &&
        response.headers["content-type"].indexOf("application/json") === 0;
}
