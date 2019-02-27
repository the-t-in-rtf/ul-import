/*

    A script to use JSON records to update known duplicates based on the source, SID, and UID.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var fs = require("fs");
var path = require("path");
var request = require("request");

require("../../../");
require("../concurrent-promise-queue");

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
                    fluid.log("Updated " + results.length + " duplicate records.");
                    processDuplicatesPromise.resolve();
                },
                processDuplicatesPromise.reject
            );
        },
        processDuplicatesPromise.reject
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
            if (error || response.statusCode !== 200) {
                outerUpdatePromise.reject(response);
            }
            else {
                try {
                    var existingRecord = JSON.parse(body);
                    var updatedRecord = fluid.extend({}, existingRecord, { uid: dupeDef.uid});
                    var productWriteOptions = fluid.extend({}, productReadOptions, { body: JSON.stringify(updatedRecord, null, 2)});
                    request(productWriteOptions, function (error, response, body) {
                        if (error || response.statusCode !== 200) {
                            outerUpdatePromise.reject(response);
                        }
                        else {
                            outerUpdatePromise.resolve(body);
                        }
                    });
                }
                catch (error) {
                    outerUpdatePromise.reject(error);
                }
            }
        });

        return outerUpdatePromise;
    };
};

fluid.defaults("gpii.ul.imports.curation.knownDuplicates", {
    gradeNames: ["fluid.component"],
    dataDir: "%ul-import/data/known-duplicates",
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

