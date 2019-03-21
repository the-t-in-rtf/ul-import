/*

    A script to use JSON records to update known duplicates based on the source, SID, and UID.  To use this script:

    1. Update the data following the process described in the header of src/abledata/tab-delimited-to-json.js
    2. Run this script.

    This script should be run after the abledata imports but before the "unifier".

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var fs = require("fs");
var path = require("path");
var request = require("request");

require("../../../");
require("../concurrent-promise-queue");

require("../launcher");
require("../login");

fluid.registerNamespace("gpii.ul.imports.curation.knownDuplicates");

gpii.ul.imports.curation.knownDuplicates.processDuplicates = function (that) {
    var processDuplicatesPromise = fluid.promise();

    var dupeDefs = gpii.ul.imports.curation.knownDuplicates.loadDuplicateDefs(that.options.dataDir);

    var loginPromise = gpii.ul.imports.login(that);
    loginPromise.then(
        function () {
            var updatePromises = fluid.transform(dupeDefs, that.updateSingleEntry);
            var updatePromiseQueue = gpii.ul.imports.promiseQueue.createQueue(updatePromises, that.options.requestsAtOnce);
            updatePromiseQueue.then(
                function (results) {
                    var updatedResults = results.filter(function (entry) { return entry; });
                    fluid.log("Updated " + updatedResults.length + "/" + results.length + " duplicate records listed in 'known duplicates' files.");
                    processDuplicatesPromise.resolve();
                },
                function (error) {
                    fluid.log("Error processing queue: ", error);
                    processDuplicatesPromise.reject(error);
                }
            );
        },
        function (error) {
            fluid.log("Error logging in:" + error);
            processDuplicatesPromise.reject(error);
        }
    );

    return processDuplicatesPromise;
};

gpii.ul.imports.curation.knownDuplicates.loadDuplicateDefs  = function (dupesDirPath) {
    var combinedResults = [];

    var resolvedPath = fluid.module.resolvePath(dupesDirPath);
    var dirFiles = fs.readdirSync(resolvedPath);

    fluid.each(dirFiles, function (filename) {
        if (filename.match(/.json5?$/i)) {
            var filePath = path.resolve(resolvedPath, filename);

            try {
                var singleFileDupeDefs = require(filePath);
                combinedResults = combinedResults.concat(singleFileDupeDefs);
            }
            catch (error) {
                fluid.log("Can't load duplicate definition file '" + filePath + "'.");
            }
        }
    });

    return combinedResults;
};

// dupeDef contains: source, sid, uid
gpii.ul.imports.curation.knownDuplicates.updateSingleEntry = function (that, dupeDef) {
    return function () {
        var outerUpdatePromise = fluid.promise();

        var productUrl = fluid.stringTemplate(that.options.productUrlTemplate, { baseUrl: that.options.urls.product, source: dupeDef.source, sid: dupeDef.sid});
        var productReadOptions = {
            url:  productUrl,
            json: true,
            jar:  true
        };
        request.get(productReadOptions, function (error, response, body) {
            if (response.statusCode === 404) {
                //fluid.log("Known duplicate '" + dupeDef.sid + "' from source '" + dupeDef.source + "' not found in the UL API.");
                outerUpdatePromise.resolve(false);
            }
            else if (error || response.statusCode !== 200) {
                outerUpdatePromise.reject(response);
            }
            else {
                try {
                    var existingRecord = body;
                    var updatedRecord = fluid.extend({}, existingRecord, { uid: dupeDef.uid});
                    var productWriteOptions = fluid.extend({}, productReadOptions, { body: updatedRecord });
                    request(productWriteOptions, function (error, response) {
                        if (error || response.statusCode !== 200) {
                            outerUpdatePromise.reject(response);
                        }
                        else {
                            outerUpdatePromise.resolve(true);
                        }
                    });
                }
                catch (error) {
                    if (!outerUpdatePromise.disposition) {
                        outerUpdatePromise.reject(error);
                    }
                    else {
                        fluid.fail(error);
                    }
                }
            }
        });

        return outerUpdatePromise;
    };
};

fluid.defaults("gpii.ul.imports.curation.knownDuplicates", {
    gradeNames: ["fluid.component"],
    dataDir: "%ul-imports/data/known-duplicates",
    requestsAtOnce: 10,
    productUrlTemplate: "%baseUrl/%source/%sid",
    invokers: {
        "updateSingleEntry": {
            funcName: "gpii.ul.imports.curation.knownDuplicates.updateSingleEntry",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // source, sid, uid
        }
    },
    listeners: {
        "onCreate.processDuplicates": {
            funcName: "gpii.ul.imports.curation.knownDuplicates.processDuplicates"
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.knownDuplicates.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-knownDuplicates-prod.json",
    "yargsOptions": {
        "describe": {
            "setLogging": "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            "outputDir":  "The directory to save the output to.   By default, the operating system's temporary directory is used."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.curation.knownDuplicates.launcher();

