/*

    Test the "promise pipeline" to ensure that:

    a) the pipeline is only as wide as allowed.
    b) all promises are executed

 */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

require("../../src/js/pipeline");

jqUnit.asyncTest("Testing promise pipeline bandwidth...", function () {
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
                jqUnit.start();
                jqUnit.fail("There should always be tokens left!");
            }

            return promise;
        });
    });

    var pipeline = gpii.ul.imports.pipeline.createPipeline(promises, 3);

    pipeline.then(
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

jqUnit.asyncTest("Testing promise pipeline results (ordering by batch)...", function () {
    var input = [0,0,0,1,1,1,2,2,2,3,3,3,4,4,4];
    var promises = [];

    fluid.each(input, function (value) {
        promises.push(function () {
            var promise = fluid.promise();

            setTimeout(function () {
                promise.resolve(value);
            }, Math.random() * 100);

            return promise;
        });
    });

    var pipeline = gpii.ul.imports.pipeline.createPipeline(promises, 3);

    pipeline.then(
        function (results) {
            jqUnit.start();
            jqUnit.assertDeepEq("The resultArray should be as expected...", input, results);
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
        },
        function () {
            jqUnit.start();
            jqUnit.fail("This should never have been reached!");
            return false;
        }
    ];



    var pipeline = gpii.ul.imports.pipeline.createPipeline(promises, 1);

    pipeline.then(
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
