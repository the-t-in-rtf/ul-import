// This script is designed to synchronise data in the UL format with an existing CouchDb instance

"use strict";
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");

var request = require("request");

fluid.registerNamespace("gpii.ul.imports.syncer");

gpii.ul.imports.syncer.LoginAndStartSync = function (that) {
    var options = {
        jar: true,
        json: true,
        body: {
            username: that.options.loginUsername,
            password: that.options.loginPassword
        }
    };
    request.post(that.options.loginUrl, options, function (error, response, body) {
        if (error) {
            fluid.log("Login returned an error:" + error);
        }
        else if (response.statusCode !== 200) {
            fluid.log("Login returned an error message:\n" + JSON.stringify(body, null, 2));
        }
        else {
            fluid.log("Logged in, starting synchronization...");
            that.syncViaREST();
        }
    });
};

gpii.ul.imports.syncer.syncViaREST = function (that) {
    var checkTasks = [];

    // Iterate through each record
    for (var a = 0; a < that.model.data.length; a++) {
        var record = typeof that.model.data[a] === "string" ? JSON.parse(that.model.data[a]) : that.model.data[a];

        // Add our task to the stack
        checkTasks.push(that.getRecordUpdatePromise(record));
    }

    // Process the stack of tasks
    fluid.promise.sequence(checkTasks).then(function () {
        fluid.log("Finished synchronizing data...");

        // Fire an event so that we can chain in the "unifier" and other services
        that.events.onSyncComplete.fire(that);
    });
};

// generate a response parser for an individual record
gpii.ul.imports.syncer.getRecordUpdatePromise = function (that, updatedRecord) {
    return function () {
        var promise = fluid.promise();

        var requestOptions = {
            json:   true,
            jar:    true,
            body:   updatedRecord
        };

        request.put(that.options.putApiUrl, requestOptions, function (error, response, body) {
            if (error) {
                fluid.log("Record update returned an error:\n" + error);
            }
            else if (response.statusCode === 200) {
                fluid.log("Record updated...");
            }
            else if (response.statusCode === 201) {
                fluid.log("Record created...");
            }
            // There was an error processing our request
            else {
                fluid.log("Record update returned an error message:\n" + JSON.stringify(body, null, 2));
            }

            promise.resolve();
        });

        return promise;
    };
};

fluid.defaults("gpii.ul.imports.syncer", {
    gradeNames:    ["fluid.modelComponent"],
    loginUsername: "admin",
    loginPassword: "admin",
    loginUrl:      "http://localhost:4896/api/user/login",
    putApiUrl:     "http://localhost:4896/api/product/",
    invokers: {
        getRecordUpdatePromise: {
            funcName: "gpii.ul.imports.syncer.getRecordUpdatePromise",
            args: ["{that}", "{arguments}.0"]
        },
        syncViaREST: {
            funcName: "gpii.ul.imports.syncer.syncViaREST",
            args: ["{that}"]
        }
    },
    model: {
        data: []
    },
    events: {
        onSyncComplete: null
    },
    modelListeners: {
        "data": {
            funcName:      "gpii.ul.imports.syncer.LoginAndStartSync",
            args:          ["{that}"],
            excludeSource: "init"
        }
    },
    listeners: {
        "onSyncComplete.log": {
            funcName: "fluid.log",
            args: ["Synchronization complete..."]
        }
    }
});
