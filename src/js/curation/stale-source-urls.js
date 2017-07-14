/*

    A script to retrieve the full list of "source" records and attempt to retrieve each of their "sourceURL" targets.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii = fluid.registerNamespace("gpii");

var request = require("request");
var fs = require("fs");

require("../dataSource");
require("../concurrent-promise-queue");

require("../launcher");

fluid.require("path");
var os = require("os");

fluid.registerNamespace("gpii.ul.imports.curation.urlChecker");

gpii.ul.imports.curation.urlChecker.getRecords = function (that) {
    that.dataSource.get().then(that.checkSourceUrls, fluid.fail);
};

gpii.ul.imports.curation.urlChecker.checkSourceUrls = function (that, results) {
    var promises = [];

    // Required to work with vendors like Vlibank, that block agents with robot-like User-Agent values.
    var requestBaseOptions = {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36"}
    };

    // For each product with a source URL, check it with a raw request.  We have to do this because dataSources only deal
    // in results, and not in things like headers and status codes.
    fluid.log("Examining ", results.products.length, " total products...");
    fluid.each(results.products, function (record) {
        if (record.sourceUrl) {
            promises.push(function () {
                var promise = fluid.promise();
                var requestOptions = fluid.merge({}, requestBaseOptions, { url: record.sourceUrl});
                request.head(requestOptions, function (error, response, body) {
                    var isError = (error || [200, 301].indexOf(response.statusCode) === -1) ? true : false;
                    var payload = {
                        isError:    isError,
                        record:     record,
                        statusCode: (response && response.statusCode) || 404
                    };
                    if (!body) {
                        isError = true;
                        error: "No content returned...";
                    }
                    else if (isError) { payload.error = error | response.statusMessage; }
                    promise.resolve(payload);
                });
                return promise;
            });
        }
    });

    fluid.log("Checking URLs for ", promises.length, " records with a source URL...");
    // Run everything through our new "concurrent promise queue"
    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);
    queue.then(
        that.processSourceUrlResults,
        fluid.fail
    );
};

gpii.ul.imports.curation.urlChecker.processSourceUrlResults = function (that, results) {
    var filteredResults = [];
    fluid.each(results, function (singleResult) {
        if (singleResult.isError) {
            filteredResults.push(singleResult);
        }
    });

    // TODO: Write logic to handle failures.
    fluid.log("Found ", filteredResults.length, " records whose source URL cannot be retrieved.");
    fs.writeFile(that.options.outputPath, JSON.stringify(filteredResults, null, 2), function (error) {
        if (error) {
            fluid.log("Error saving results: ", error);
        }
        else {
            fluid.log("Saved results to ", that.options.outputPath);
        }
    });
};

fluid.defaults("gpii.ul.imports.curation.urlChecker", {
    gradeNames: ["fluid.component"],
    maxRequests: 100,
    outputDir: os.tmpdir(),
    outputFilename: "stale-source-urls.json",
    outputPath: "@expand:path.resolve({that}.options.outputDir, {that}.options.outputFilename)",
    urls: {
        allRecords: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["%productsUrl?unified=false&limit=100000" , { productsUrl: "{that}.options.urls.products"}]
            }
        }
    },
    components: {
        dataSource: {
            type: "gpii.ul.imports.dataSource",
            options: {
                url: "{urlChecker}.options.urls.allRecords"
            }
        }
    },
    listeners: {
        "onCreate.getRecords": {
            funcName: "gpii.ul.imports.curation.urlChecker.getRecords",
            args: ["{that}"]
        }
    },
    invokers: {
        checkSourceUrls: {
            funcName: "gpii.ul.imports.curation.urlChecker.checkSourceUrls",
            args:     ["{that}", "{arguments}.0"]
        },
        processSourceUrlResults: {
            funcName: "gpii.ul.imports.curation.urlChecker.processSourceUrlResults",
            args:     ["{that}", "{arguments}.0"]
        }
    }

});

fluid.defaults("gpii.ul.imports.curation.urlChecker.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-source-urls-prod.json",
    "yargsOptions": {
        "describe": {
            "setLogging": "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            "outputPath": "The full path to save the output to.   By default, a file named stale-source-urls.json is saved to the operating system's temporary directory."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.curation.urlChecker.launcher();
