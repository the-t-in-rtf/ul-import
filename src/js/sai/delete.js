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
    var promises = [];
    var loginPromise = gpii.ul.imports.login(that);
    promises.push(loginPromise);
    promises.push(that.productReader.get());

    promises.push(function () {
        var unifiedReadPromise = fluid.promise();
        var unifiedReadOptions = {
            jar: true,
            json: true,
            headers: {
                "accept": "application/json"
            },
            url: that.options.urls.products + "?sources=[%22unified%22,%22sai%22]&limit=100000&status=[%22deleted%22]&unified=false"
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
    var unifiedRecordKeysToUpdate = {};
    var saiRecordsToUpdate = [];
    var saiRecordsFlaggedForDeletion = results[1];
    var deletedUnifiedRecords = results[2].products;
    var alreadyDeletedUnifiedRecords = [];
    var alreadyDeletedSaiRecords = [];
    fluid.each(saiRecordsFlaggedForDeletion, function (saiRecord) {
        var deletedUnifiedRecord = fluid.find(deletedUnifiedRecords, function (deletedRecord) {
            if (deletedRecord.source === "unified" && deletedRecord.sid === saiRecord.uid) {
                return deletedRecord;
            }
        });
        if (deletedUnifiedRecord) {
            alreadyDeletedUnifiedRecords.push(deletedUnifiedRecord);
        }
        else {
            unifiedRecordKeysToUpdate[saiRecord.uid] = true;
        }
        var deletedSaiRecord = fluid.find(deletedUnifiedRecords, function (deletedRecord) {
            if (deletedRecord.source === "sai" && deletedRecord.sid === saiRecord.nid) {
                return deletedRecord;
            }
        });
        if (deletedSaiRecord) {
            alreadyDeletedSaiRecords.push(deletedSaiRecord);
        }
        else {
            saiRecordsToUpdate.push(deletedSaiRecord);
        }
    });

    var unifiedRecordUidsToUpdate = Object.keys(unifiedRecordKeysToUpdate);

    fluid.log("Found " + alreadyDeletedUnifiedRecords.length + " unified records that have already been flagged as deleted...");
    fluid.log("Found " + unifiedRecordUidsToUpdate.length + " unified records that need to be flagged as deleted...");
    fluid.log("Found " + alreadyDeletedSaiRecords.length + " SAI records that have already been flagged as deleted...");
    fluid.log("Found " + saiRecordsToUpdate.length + " SAI records that need to be flagged as deleted...");

    if (unifiedRecordUidsToUpdate.length || saiRecordsToUpdate.length) {
        if (that.options.commit) {
            var unifiedRecordsToUpdate = fluid.transform(unifiedRecordUidsToUpdate, function (uid) { return { sid: uid, source: "unified" }; });
            var combinedRecordsToUpdate = saiRecordsToUpdate.concat(unifiedRecordsToUpdate);
            gpii.ul.imports.sai.deletes.loginAndDeleteRecords(that, combinedRecordsToUpdate);
        }
        else {
            fluid.log("Run with --commit to flag unified records as deleted...");
        }
    }

};

gpii.ul.imports.sai.deletes.loginAndDeleteRecords = function (that, recordsToUpdate) {
    var promises = fluid.transform(recordsToUpdate, function (recordToUpdate) {
        return function () {
            var promise = fluid.promise();
            var deleteOptions = {
                jar: true,
                json: true,
                url: that.options.urls.product + "/" + recordToUpdate.source + "/" + recordToUpdate.sid
            };

            request.del(deleteOptions, function (error, response, body) {
                if (error) {
                    fluid.log("Error deleting ", recordToUpdate.source, " record '",  recordToUpdate.sid, "':", error);
                }
                else if (response.statusCode !== 200) {
                    fluid.log("Error response deleting ", recordToUpdate.source, " record '", recordToUpdate.sid, "':", body.message);
                }

                promise.resolve(body);
            });

            return promise;
        };
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

    queue.then(
        function (results) {
            var savedRecords = results.filter(function (result) { return !result.isError;});
            var errors = results.filter(function (result) { return result.isError;});
            fluid.log("Updated ", savedRecords.length, " records with ", errors.length, " errors...");
        },
        fluid.fail
    );
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
