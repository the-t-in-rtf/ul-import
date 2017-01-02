// Test the scripts that compare federated database member data to our current holdings.
"use strict";
var fluid   = require("infusion");
fluid.loadTestingSupport();

var gpii    = fluid.registerNamespace("gpii");
var jqUnit  = require("node-jqunit");
var kettle  = require("kettle");
kettle.loadTestingSupport();

require("../../src/js/syncer");
require("./test-harness");

fluid.defaults("gpii.tests.ul.imports.syncer.request", {
    gradeNames: ["kettle.test.request.httpCookie"],
    port:       "{testEnvironment}.options.ports.api",
    headers: {
        accept: "application/json"
    },
    path: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["%apiUrl%endpoint", { apiUrl: "{testEnvironment}.options.urls.api", endpoint: "{that}.options.endpoint" }]
        }
    }
});

fluid.registerNamespace("gpii.tests.ul.imports.syncer.caseHolder");

gpii.tests.ul.imports.syncer.caseHolder.checkSingleRecord = function (message, expected, actual, mustBeDefined) {
    jqUnit.assertLeftHand(message + "(deep comparison)...", expected, actual);

    fluid.each(fluid.makeArray(mustBeDefined), function (field) {
        jqUnit.assertNotUndefined("message (" + field + " check)...", actual[field]);
    });
};

gpii.tests.ul.imports.syncer.caseHolder.checkProductsResponse = function (results) {
    jqUnit.assertEquals("There should be three products in the results...", 3, results.products.length);
};

fluid.defaults("gpii.tests.ul.imports.syncer.caseHolder", {
    gradeNames: ["fluid.test.testCaseHolder"],
    testData:  [
        { "name": "existing with updates", "description": "existing record with updates", "status": "active", "source": "~existing", "sid": "existing", "manufacturer": { "name": "Acme Inc."} },
        { "name": "new", "description": "new record", "source": "~existing", "sid": "new", "status": "new", "manufacturer": { "name": "Acme Inc."} }
    ],
    modules: [{
        name: "Testing synchronization mechanism...",
        tests: [{
            name: "Examine the results after a synchronisation...",
            type: "test",
            sequence: [
                // TODO: Replace with standard sequence elements
                {
                    func: "{testEnvironment}.events.constructFixtures.fire"
                },
                {
                    event: "{testEnvironment}.events.onFixturesConstructed",
                    listener: "{testEnvironment}.syncer.applier.change",
                    args: ["data", "{that}.options.testData"]
                },
                {
                    event:    "{testEnvironment}.syncer.events.onSyncComplete",
                    listener: "{loginRequest}.send",
                    args:     [{ username: "existing", password: "password"}]
                },
                {
                    event:    "{loginRequest}.events.onComplete",
                    listener: "{newRecordRequest}.send"
                },
                {
                    event:    "{newRecordRequest}.events.onComplete",
                    listener: "gpii.tests.ul.imports.syncer.caseHolder.checkSingleRecord",
                    args:     ["The new record should have been saved...", {}, "@expand:JSON.parse({arguments}.0)", ["status", "updated"]] // message, expected, actual, mustBeDefined
                },
                {
                    func: "jqUnit.assertEquals",
                    args: ["The request for a new record should have been successful...", 200, "{newRecordRequest}.nativeResponse.statusCode"]
                },
                {
                    func: "{existingRecordRequest}.send"
                },
                {
                    event:    "{existingRecordRequest}.events.onComplete",
                    listener: "gpii.tests.ul.imports.syncer.caseHolder.checkSingleRecord",
                    args:     ["The existing record should have been updated...", { name: "existing with updates" }, "@expand:JSON.parse({arguments}.0)", ["status", "updated"]] // message, expected, actual, mustBeDefined
                },
                {
                    func: "jqUnit.assertEquals",
                    args: ["The request for an existing record should have been successful...", 200, "{existingRecordRequest}.nativeResponse.statusCode"]
                },
                {
                    func: "{productsRequest}.send"
                },
                {
                    event:    "{productsRequest}.events.onComplete",
                    listener: "gpii.tests.ul.imports.syncer.caseHolder.checkProductsResponse",
                    args:     ["@expand:JSON.parse({arguments}.0)"]
                },
                {
                    func: "jqUnit.assertEquals",
                    args: ["The products request should have been successful...", 200, "{productsRequest}.nativeResponse.statusCode"]
                },
                {
                    func: "{testEnvironment}.events.stopFixtures.fire"
                }
            ]
        }]
    }],
    components: {
        cookieJar: {
            type: "kettle.test.cookieJar"
        },
        loginRequest: {
            type: "gpii.tests.ul.imports.syncer.request",
            options: {
                endpoint: "/api/user/login",
                method:   "POST"
            }
        },
        newRecordRequest: {
            type: "gpii.tests.ul.imports.syncer.request",
            options: {
                endpoint: "/api/product/~existing/new"
            }
        },
        existingRecordRequest: {
            type: "gpii.tests.ul.imports.syncer.request",
            options: {
                endpoint: "/api/product/~existing/existing"
            }
        },
        productsRequest: {
            type: "gpii.tests.ul.imports.syncer.request",
            options: {
                endpoint: "/api/products?sources=%22~existing%22&unified=false"
            }
        }
    }
});

fluid.defaults("gpii.tests.ul.imports.sync.environment", {
    gradeNames: ["fluid.test.testEnvironment", "gpii.tests.ul.imports.harness"],
    ports: {
        api:    "3598",
        couch:  "9998"
    },
    components: {
        syncer: {
            type: "gpii.ul.imports.syncer",
            options: {
                loginUrl:  "{harness}.options.urls.login",
                putApiUrl: "{harness}.options.urls.product",
                loginUsername: "existing",
                loginPassword: "password"
            }
        },
        caseHolder: {
            type: "gpii.tests.ul.imports.syncer.caseHolder"
        }
    }
});

fluid.test.runTests("gpii.tests.ul.imports.sync.environment");
