/*

    Look through the list of SAI records flagged for deletion and update the corresponding "unified" record.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");

require("../launcher");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.sai.deletes");

gpii.ul.imports.sai.deletes.retrieveRecords = function (that) {
    var readerPromise = that.productReader.get();
    readerPromise.then(that.processSaiResults, fluid.fail);
};

gpii.ul.imports.sai.deletes.processSaiResults = function (that, results) {
    var recordsToUpdate = {};
    fluid.each(results, function (row) {
        if (row.uid && !row.duplicate_nid) {
            recordsToUpdate[row.uid] = true;
        }
    });

    var distinctUids = Object.keys(recordsToUpdate);

    if (that.options.commit) {
        gpii.ul.imports.sai.deletes.loginAndDeleteRecords(that, distinctUids);
    }
    else {
        fluid.log("Found " + distinctUids.length + " unified records that should be flagged for deletion, run with --commit to delete...");
    }
};

gpii.ul.imports.sai.deletes.loginAndDeleteRecords = function (that, distinctUids) {
    fluid.log("Logging in to UL API...");
    var options = {
        jar: true,
        json: true,
        body: {
            username: that.options.username,
            password: that.options.password
        }
    };
    request.post(that.options.urls.login, options, function (error, response, body) {
        if (error) {
            fluid.log("Login returned an error:" + error);
        }
        else if (response.statusCode !== 200) {
            fluid.log("Login returned an error message:\n" + JSON.stringify(body, null, 2));
        }
        else {
            fluid.log("Logged in...");
            var promises = fluid.transform(distinctUids, function (uid) {
                return function () {
                    var promise = fluid.promise();
                    var deleteOptions = {
                        jar: true,
                        json: true,
                        url: that.options.urls.product + "/unified/" + uid
                    };

                    request.del(deleteOptions, function (error, response, body) {
                        if (error) {
                            fluid.log("Error deleting record '" + uid + "':", error);
                        }
                        else if (response.statusCode !== 200) {
                            fluid.log("Error response deleting record + '" + uid + "':", body.message);
                        }

                        promise.resolve();
                    });

                    return promise;
                };
            });

            var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

            queue.then(
                function (results) {
                    fluid.log("Updated " + results.length + " unified records flagged as deleted in the SAI...");
                },
                fluid.fail
            );
        }
    });
};

fluid.defaults("gpii.ul.imports.sai.deletes", {
    gradeNames: ["fluid.component"],
    maxRequests: 100,
    components: {
        productReader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.sai.deletes}.options.urls.sai.deletes",
                termMap: {}
            }
        }
    },
    invokers: {
        "processSaiResults": {
            funcName: "gpii.ul.imports.sai.deletes.processSaiResults",
            args: ["{that}", "{arguments}.0"] // results
        }
    },
    listeners: {
        "onCreate.retrieveRecords": {
            funcName: "gpii.ul.imports.sai.deletes.retrieveRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.sai.deletes.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/sai-deletes-prod.json",
    "yargsOptions": {
        "describe": {
            "username":         "The username to use when writing records to the UL.",
            "password":         "The password to use when writing records to the UL.",
            "setLogging":       "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            "urls.sai.deletes": "The URL to use when retrieving merged/deleted record data from the SAI.",
            "commit":           "Whether or not to update the unified records (defaults to 'false')."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.sai.deletes.launcher();
