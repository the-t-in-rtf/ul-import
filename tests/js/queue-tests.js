/*

    Test the "promise queue" to ensure that:

    a) the queue is only as wide as allowed.
    b) all promises are executed

 */
"use strict";
var fluid = require("infusion");
fluid.loadTestingSupport();

var gpii = fluid.registerNamespace("gpii");

require("../../src/js/concurrent-promise-queue");

fluid.defaults("gpii.tests.ul.imports.sequenceElements.pause", {
    gradeNames: "fluid.test.sequenceElement",
    sequence: [
        {
            func: "{testEnvironment}.pause"
        },
        {
            event: "{testEnvironment}.events.pauseCompleted",
            listener: "fluid.log",
            args: ["Initial pause completed."]
        }
    ]
});

fluid.defaults("gpii.tests.ul.imports.sequence", {
    gradeNames: "fluid.test.sequence",
    sequenceElements: {
        startHarness: {
            gradeNames: "gpii.tests.ul.imports.sequenceElements.pause",
            priority:   "before:sequence"
        }
    }
});

fluid.defaults("gpii.tests.ul.imports.queue.caseHolder",{
    gradeNames: ["fluid.test.testCaseHolder"],
    inputs: {
        resolveValue: "@expand:fluid.generate(10, true)"
    },
    modules: [{
        name: "Concurrent promise queue tests.",
        tests: [
            {
                name: "Testing promise queue bandwidth...",
                type: "test",
                sequenceGrade: "gpii.tests.ul.imports.sequence",
                sequence: [{
                    task: "gpii.tests.ul.imports.queue.caseHolder.generateBandwidthSequence",
                    resolveFn: "jqUnit.assert",
                    resolveArgs: ["The sequence should have completed..."]
                }]
            },
            {
                name: "Testing promise rejection handling...",
                type: "test",
                sequenceGrade: "gpii.tests.ul.imports.sequence",
                sequence: [{
                    task: "gpii.tests.ul.imports.queue.caseHolder.generateBandwidthSequence",
                    rejectFn: "jqUnit.assertEquals",
                    rejectArgs: ["The rejection should have been passed up the chain.", "Promise rejected.", "{arguments}.0"]
                }]
            },
            {
                name: "Testing overall `resolve` value for queue...",
                type: "test",
                sequenceGrade: "gpii.tests.ul.imports.sequence",
                sequence: [{
                    task: "gpii.tests.ul.imports.queue.caseHolder.generateResolveValueSequence",
                    args: ["{that}.options.resolveValue"],
                    resolveFn: "jqUnit.assertDeepEq",
                    resolveArgs: ["The results should be visible when the queue resolves...", "{that}.options.resolveValue", "{arguments}.0"]
                }]
            }
        ]
    }]
});

gpii.tests.ul.imports.queue.caseHolder.generateBandwidthSequence = function () {
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
    return queue;
};

gpii.tests.ul.imports.queue.caseHolder.generateRejectionSequence = function () {
    var promises = [
        function () {
            var promise = fluid.promise();
            promise.reject("Promise rejected.");
            return promise;
        }
    ];

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 1);
    return queue;
};

gpii.tests.ul.imports.queue.caseHolder.generateResolveValueSequence = function (input) {
    var promises = [];

    fluid.each(input, function (value) {
        promises.push(function () {
            var promise = fluid.promise();
            setTimeout(function () { promise.resolve(value); }, Math.random() * 100);
            return promise;
        });
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 3);
    return queue;
};

fluid.registerNamespace("gpii.tests.ul.imports.queue.environment");

gpii.tests.ul.imports.queue.environment.pause = function (that) {
    setTimeout(that.events.pauseCompleted.fire, that.options.pauseDuration);
};

fluid.defaults("gpii.tests.ul.imports.queue.environment", {
    gradeNames: ["fluid.test.testEnvironment"],
    pauseDuration: 25,
    events: {
        pauseCompleted: null
    },
    invokers: {
        pause: {
            funcName: "gpii.tests.ul.imports.queue.environment.pause",
            args:     ["{that}"]
        }
    },
    components: {
        caseHolder: {
            type: "gpii.tests.ul.imports.queue.caseHolder"
        }
    }
});

fluid.test.runTests("gpii.tests.ul.imports.queue.environment");
