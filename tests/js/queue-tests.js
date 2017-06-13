/*

    Test the "promise queue" to ensure that:

    a) the queue is only as wide as allowed.
    b) all promises are executed

 */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

require("../../src/js/concurrent-promise-queue");

jqUnit.asyncTest("Testing promise queue bandwidth...", function () {
    var tokens = [0,1,2];
    var input = fluid.generate(10, true);
    var promises = [];

    fluid.each(input, function (value) {
        promises.push(function () {
            var promise = fluid.promise();

            if (tokens.length) {
                var myToken = tokens.pop();
                setTimeout(function () {
                    tokens.push(myToken);
                    promise.resolve(value);
                }, Math.random() * 100);
            }
            else {
                promise.reject("Ran out of tokens!");
            }

            return promise;
        });
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 3);
    queue.then(
        function () {
            jqUnit.start();
            jqUnit.assert("The sequence should have completed...");
        },
        function (error) {
            jqUnit.start();
            jqUnit.fail(error);
        }
    );
});

jqUnit.asyncTest("Testing promise rejection handling...", function () {
    var promises = [
        function () {
            var promise = fluid.promise();
            promise.reject("Promise rejected.");
            return promise;
        }
    ];

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 1);
    queue.then(
        function () {
            jqUnit.start();
            jqUnit.fail("The sequence should have been rejected.");
        },
        function (error) {
            jqUnit.start();
            jqUnit.assertEquals("The rejection should have been passed up the chain.", "Promise rejected.", error);
        }
    );
});

jqUnit.asyncTest("Testing overall `resolve` value for queue...", function () {
    var input = fluid.generate(10, true);
    var promises = [];

    fluid.each(input, function (value) {
        promises.push(function () {
            var promise = fluid.promise();
            setTimeout(function () { promise.resolve(value); }, Math.random() * 100);
            return promise;
        });
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 3);
    queue.then(
        function (results) {
            jqUnit.start();
            jqUnit.assertDeepEq("The results should be visible when the queue resolves...", input, results);
            jqUnit.assert("The sequence should have completed...");
        },
        function (error) {
            jqUnit.start();
            jqUnit.fail(error);
        }
    );
});

jqUnit.asyncTest("Test for premature queue completion...", function () {
    var promises = [function () { return fluid.promise(); }];
    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 25);
    queue.then(
        function () {
            jqUnit.start();
            jqUnit.fail("The queue should not have resolved on its own...");
        },
        function () {
            jqUnit.start();
            jqUnit.fail("The queue should not have been rejected on its own...");
        }
    );

    setTimeout(function () {
        jqUnit.start();
        jqUnit.assertUndefined("There should be no disposition for the queue...", queue.disposition);
    }, 500);
});

