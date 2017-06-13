/*

    A promise "pipeline" that wraps an array of promises in a "sequence of sequences" to ensure that only a limited
    number are attempted at any one time.  Note, you must use a "promise returning function" to really benefit from
    this.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.pipeline");

/**
 *
 * A function to create a "pipeline" of promises, a "sequence of sequences" in which at most `promisesPerSequence`
 * promises are executed at a time.
 *
 * @param promiseArray
 * @param promisesPerSequence
 */
gpii.ul.imports.pipeline.createPipeline = function (promiseArray, promisesPerSequence) {
    var outerPromise = fluid.promise();

    var subSequences = [];
    var remainingPromises = promiseArray;

    while (remainingPromises.length) {
        var promisesThisTime = remainingPromises.slice(0,promisesPerSequence);
        remainingPromises = remainingPromises.slice(promisesPerSequence);
        subSequences.push(gpii.ul.imports.pipeline.createSubSequence(promisesThisTime));
    }

    fluid.promise.sequence(subSequences).then(
        function (arrayOfArrays) {
            var collapsedArray = [];
            fluid.each(arrayOfArrays, function (singleArray) {
                collapsedArray.push.apply(collapsedArray, singleArray);
            });
            outerPromise.resolve(collapsedArray);
        },
        outerPromise.reject
    );
    return outerPromise;
};

gpii.ul.imports.pipeline.createSubSequence = function (promiseArray) {
    return function () {
        var runningPromises = [];
        fluid.each(promiseArray, function (singlePromise) {
            // Within a subsequence, ensure that all entries are launched.
            if (singlePromise instanceof Function) {
                runningPromises.push(singlePromise());
            }
            else {
                runningPromises.push(singlePromise);
            }
        });
        return fluid.promise.sequence(runningPromises);
    };
};
