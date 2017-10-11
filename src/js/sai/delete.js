/*

    Look through the list of SAI records flagged for deletion and update the corresponding "unified" record.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");

require("../launcher");
require("../login");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.sai.deletes");

gpii.ul.imports.sai.deletes.retrieveRecords = function (that) {
    // TODO: Retrieve the list of unified records so that we can report on how many to be changed and only
    // change those that are not already deleted.
    var promises = [];
    promises.push(that.productReader.get());

    promises.push(function () {
        var unifiedReadPromise = fluid.promise();
        var unifiedReadOptions = {
            json: true,
            headers: {
                "accept": "application/json"
            },
            url: that.options.urls.products + "?sources=[%22unified%22]&limit=100000&status=[%22deleted%22]&unified=false"
        };
        request.get(unifiedReadOptions, function (error, response, body) {
            if (error) {
                unifiedReadPromise.reject(error);
            }
            else if (response.statusCode !== 200) {
                unifiedReadPromise.reject(body);
            }
            else {
                unifiedReadPromise.resolve(body);
            }
        });
        return unifiedReadPromise;
    });
    var sequence = fluid.promise.sequence(promises);
    sequence.then(that.processSaiResults, fluid.fail);
};

gpii.ul.imports.sai.deletes.processSaiResults = function (that, results) {
    var recordsToUpdate = {};
    var saiRecordsFlaggedForDeletion = results[0];
    var deletedUnifiedRecords = results[1].products;
    var alreadyDeleted = [];
    fluid.each(saiRecordsFlaggedForDeletion, function (saiRecord) {
        var alreadyDeletedRecord = fluid.find(deletedUnifiedRecords, function (deletedUnifiedRecord) {
            if (deletedUnifiedRecord.sid === saiRecord.uid) {
                return deletedUnifiedRecord;
            }
        });
        if (alreadyDeletedRecord) {
            alreadyDeleted.push(alreadyDeletedRecord);
        }
        else {
            recordsToUpdate[saiRecord.uid] = true;
        }
    });

    var distinctUidsToDelete = Object.keys(recordsToUpdate);

    fluid.log("Found " + alreadyDeleted.length + " unified records that have already been flagged as deleted...");
    fluid.log("Found " + distinctUidsToDelete.length + " unified records that need to be flagged as deleted...");

    if (distinctUidsToDelete.length) {
        if (that.options.commit) {
            gpii.ul.imports.sai.deletes.loginAndDeleteRecords(that, distinctUidsToDelete);
        }
        else {
            fluid.log("Run with --commit to delete these records...");
        }
    }
};

gpii.ul.imports.sai.deletes.loginAndDeleteRecords = function (that, distinctUids) {
    gpii.ul.imports.login(that).then(function () {
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

                    promise.resolve(body);
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
