/*

    Look through the list of SAI records flagged for merger and merge them.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");

require("../launcher");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.sai.merge");

gpii.ul.imports.sai.merge.retrieveRecords = function (that) {
    var promises = [];
    promises.push(function () { return that.deletesReader.get(); });
    promises.push(function () { return that.saiRecordsReader.get(); });

    var sequence = fluid.promise.sequence(promises);
    sequence.then(that.processSaiResults, fluid.fail);
};

gpii.ul.imports.sai.merge.processSaiResults = function (that, results) {
    var deletes = results[0];
    var allSaiRecords = results[1];

    var uidsByNid = {};
    fluid.each(allSaiRecords, function (row) {
        if (row.uid && row.nid) {
            uidsByNid[row.nid] = row.uid;
        }
    });

    var sourcesByTarget = {};
    fluid.each(deletes, function (row) {
        if (row.duplicate_nid) {
            var uid = uidsByNid[row.duplicate_nid];
            if (uid) {
                if (!sourcesByTarget[uid]) { sourcesByTarget[uid] = [];}
                sourcesByTarget[uid].push(row.uid);
            }
            else {
                fluid.log("Can't work with bogus duplicate_nid '" + row.duplicate_nid + "'...");
            }
        }
    });

    var recordsToUpdate = Object.keys(sourcesByTarget).length;
    if (!recordsToUpdate) {
        fluid.log("No duplicate records to merge...");
    }
    else if (that.options.commit) {
        gpii.ul.imports.sai.merge.loginAndMergeRecords(that, sourcesByTarget);
    }
    else {
        fluid.log("Found " + recordsToUpdate + " unified records that should be merged, run with --commit to merge...");
    }
};

gpii.ul.imports.sai.merge.loginAndMergeRecords = function (that, sourcesByTarget) {
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
            var promises = [];
            fluid.each(sourcesByTarget, function (sources, target) {
                promises.push(function () {
                    var promise = fluid.promise();
                    var mergeOptions = {
                        jar: true,
                        json: true,
                        url: that.options.urls.merge + "?target=" + JSON.stringify(target) + "&sources=" + JSON.stringify(sources)
                    };

                    request.post(mergeOptions, function (error, response, body) {
                        if (error) {
                            fluid.log("Error merging record '" + target + "':", error);
                        }
                        else if (response.statusCode !== 200) {
                            fluid.log("Error response merging record + '" + target + "':", body.message);
                        }

                        promise.resolve();
                    });

                    return promise;
                });
            });

            var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

            queue.then(
                function (results) {
                    fluid.log("Merged " + results.length + " unified records based on updates from the SAI...");
                },
                fluid.fail
            );
        }
    });
};

fluid.defaults("gpii.ul.imports.sai.merge", {
    gradeNames: ["fluid.component"],
    maxRequests: 100,
    components: {
        deletesReader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.sai.merge}.options.urls.sai.deletes",
                termMap: {}
            }
        },
        saiRecordsReader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.sai.merge}.options.urls.sai.records",
                termMap: {}
            }
        }
    },
    invokers: {
        "processSaiResults": {
            funcName: "gpii.ul.imports.sai.merge.processSaiResults",
            args: ["{that}", "{arguments}.0"] // results
        }
    },
    listeners: {
        "onCreate.retrieveRecords": {
            funcName: "gpii.ul.imports.sai.merge.retrieveRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.sai.merge.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/sai-merge-prod.json",
    "yargsOptions": {
        "describe": {
            "username":         "The username to use when writing records to the UL.",
            "password":         "The password to use when writing records to the UL.",
            "setLogging":       "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            "urls.sai.merge": "The URL to use when retrieving merged/deleted record data from the SAI.",
            "commit":           "Whether or not to update the unified records (defaults to 'false')."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.sai.merge.launcher();
