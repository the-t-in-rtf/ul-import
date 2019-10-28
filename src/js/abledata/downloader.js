/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var request = require("request");

require("gpii-universal");
fluid.require("%settingsHandlers");

require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.ableData.downloader");

gpii.ul.imports.ableData.downloader.getRecordsByDate = function (that) {
    var overallGetPromise = fluid.promise();

    var retrievalPromises = [];

    // One pass for "early results", i.e. the distant pass.
    retrievalPromises.push(gpii.ul.imports.ableData.downloader.generateDownloadFn(that.options.urlTemplates.xml, 1900, 2000, 1, 12 ));

    var thisYear = (new Date()).getFullYear();
    // Pull in records in batches by quarter for each recent year.
    for (var yearToDownload = 2001; yearToDownload <= thisYear; yearToDownload++) {
        for (var month = 1; month <= 12; month++) {
            retrievalPromises.push(gpii.ul.imports.ableData.downloader.generateDownloadFn(that.options.urlTemplates.xml, yearToDownload, yearToDownload, month, month));
        }
    }

    var retrievalQueue = gpii.ul.imports.promiseQueue.createQueue(retrievalPromises, 5);
    retrievalQueue.then(function (results) {
        var parsedRecords = [];
        // Because we now have multiple sets of records, we have to do a little light preprocessing to combine the results.
        fluid.each(results, function (singleXmlPayload) {
            var parsedXml = gpii.settingsHandlers.XMLHandler.parser.parse(singleXmlPayload, that.options.xmlParserRules);
            parsedRecords = parsedRecords.concat(parsedXml);
        });
        overallGetPromise.resolve(parsedRecords);
    }, overallGetPromise.reject);

    return overallGetPromise;
};

gpii.ul.imports.ableData.downloader.generateDownloadFn = function (urlTemplate, startYear, endYear, startMonth, endMonth) {
    return function () {
        var downloadPromise = fluid.promise();
        var startDay = 1;
        // TODO: Deal with February 29th.
        var endDay = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][endMonth];
        var singleBatchUrl = fluid.stringTemplate(urlTemplate, { startYear: startYear, endYear: endYear, startMonth: startMonth, endMonth: endMonth, startDay: startDay, endDay: endDay });
        fluid.log("Requesting records from " + startMonth + "/" + startYear + " to " + endMonth + "/" + endYear + "...");
        request.get(singleBatchUrl, { strictSSL: false }, function (error, response, body) {
            fluid.log("Processing records from " + startMonth + "/" + startYear + " to " + endMonth + "/" + endYear + "...");
            if (error) {
                downloadPromise.reject(error);
            }
            else if (response.statusCode !== 200) {
                downloadPromise.reject(response);
            }
            else {
                downloadPromise.resolve(body);
            }
        });
        return downloadPromise;
    };
};

fluid.defaults("gpii.ul.imports.ableData.downloader", {
    gradeNames: ["gpii.ul.imports.downloader"],
    xmlParserRules: {
        rules: {
            // Drill down to only the objects we care about to simplify the transform paths
            products: "nodes.node"
        }
    },
    invokers: {
        get: {
            funcName: "gpii.ul.imports.ableData.downloader.getRecordsByDate",
            args: ["{that}"]
        }
    },
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.none" // We are dealing with XML data.
        }
    }
});
