/*

    Provides functions to process an array of promises, ensuring that no more than a given number are executed
    simultaneously, and to ensure that as promises complete, if there are new promises in the queue, they are
    executed.

    Roughly comparable to the when.js `guard` function: https://github.com/cujojs/when/blob/master/docs/api.md#whenguard

    These functions are meant only to be used as used in this package, i.e. as a means of processing an array of
    promise-returning functions and resolving to an array of results or to a rejection.  The order of the final results
    is not by any means stable.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.promiseQueue");

/**
 *
 * Create a "concurrent promise queue" that will ensure that only `promisesAtOnce` promises are executed at a given time.
 * As a promise resolves, the next promise in `incomingPromiseQueue` is called.  If there are no remaining promises in
 * `incomingPromiseQueue`, each promise will check to see if it is the last to complete.  If it is, the queue itself
 * will be flagged as being resolved.
 *
 * Note that if you are working with asynchronous functions that do not return a promise, you are expected to wrap them
 * in a promise yourself.  Failure to do so may result in timing errors, where the promise queue indicates that its
 * work is done while asynchronous functions are still working.
 *
 * Note that if you choose to add promises to this array, their execution will not be governed by the `promisesAtOnce`
 * limit.
 *
 * @param {Array} promiseArray - An array of promise instances, promise-returning functions, synchronous functions returning a value, and simple values.
 * @param {Integer} promisesAtOnce - The number of promises that are allowed to execute at a single time.
 * @return {Promise} - A `fluid.promise` that will resolve when all promises in the "queue" are processed or reject if
 * any promise in the "queue" is rejected.
 *
 */
gpii.ul.imports.promiseQueue.createQueue = function (promiseArray, promisesAtOnce) {
    var queuePromise = fluid.promise();
    var totalPromises = fluid.makeArray(promiseArray).length;
    var resolutions = [];

    var incomingPromiseQueue = fluid.copy(promiseArray);

    for (var a = 0; a < Math.min(promisesAtOnce, totalPromises); a++) {
        var singlePromise = incomingPromiseQueue.pop();
        if (singlePromise) {
            gpii.ul.imports.promiseQueue.wrapSinglePromise(singlePromise, queuePromise, incomingPromiseQueue, resolutions, totalPromises);
        }
    }

    return queuePromise;
};

gpii.ul.imports.promiseQueue.wrapSinglePromise = function (originalPromise, queuePromise, incomingPromiseQueue, resolutions, totalPromises) {
    var wrappedPromise = fluid.promise();
    wrappedPromise.then(function (singleResult) {
        resolutions.push(singleResult);

        var singlePromise = incomingPromiseQueue.pop();
        if (singlePromise) {
            gpii.ul.imports.promiseQueue.wrapSinglePromise(singlePromise, queuePromise, incomingPromiseQueue, resolutions, totalPromises);
        }
        else if (resolutions.length === totalPromises) {
            queuePromise.resolve(resolutions);
        }
    }, queuePromise.reject);

    if (fluid.isPromise(originalPromise)) {
        fluid.fail("Error, you must use promise-returning functions rather than raw promises...");
    }
    else if (originalPromise instanceof Function) {
        var promiseOrValue = originalPromise();
        // We are dealing with a promise-returning function, wire it up to the wrapper's resolve and reject functions.
        // See http://docs.fluidproject.org/infusion/development/PromisesAPI.html#fluid-ispromise-totest-
        if (fluid.isPromise(promiseOrValue)) {
            promiseOrValue.then(wrappedPromise.resolve, wrappedPromise.reject);
        }
        // Assume this promise returns a simple value.
        else {
            fluid.fail("Error, You must use promise-returning functions rather than value-returning functions...");
        }
    }
    // Assume this promise consists of a simple value.
    else {
        fluid.fail("Error, You must use promise-returning functions rather than raw values...");
    }

    return wrappedPromise;
};
