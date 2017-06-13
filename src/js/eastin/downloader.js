/*

  This component downloads data from EASTIN in two passes when its `download` invoker is called. It:

    1. Downloads the list of records for all relevant ISO codes.
    2. Downloads the unique individual records based on these lists.

  Both operations build up their results slowly in `member` variables.  The final results are applied as a change to the
  `records` model variable.  You can either listen for changes to that variable directly or set that variable to a piece
  of your own  model that has listeners of its own.

  For your convenience, an `onRecordsRetrieved` event is also fired when the second stage is complete.

 */
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.eastin.downloader");

var request = require("request");

require("../concurrent-promise-queue");

/* TODO: Only look up records newer than the cache using the new lastUpdateMin parameter
 and the maximum LastUpdateDate value stored in the cache */
// http://webservices.eastin.eu/cloud4all/searches/products/listsimilarity?isoCodes=22.24.24&lastUpdateMin=2014-01-01T12:00
// The date format is yyyy-mm-ddThh:ss

gpii.ul.imports.eastin.downloader.getRetrieveRecordListByIsoCodeFunction = function (that, isoCode) {
    var myIsoCode = isoCode;
    return function retrieveRecordListByIsoCode() {
        var promise = fluid.promise();
        var options = {
            "url": that.options.urls.listSimilar,
            "qs": {
                "isoCodes": myIsoCode
            }
        };

        fluid.log("Starting to retrieve isoCode '" + isoCode + "'...");
        request(options, function (error, response, body) {
            if (error) {
                fluid.log(error);
            }
            else {
                try {
                    var data = JSON.parse(body);

                    // If we receive an "ExceptionMessage" object, display its contents in the console.
                    if (!data.Ok && data.ExceptionMessages) {
                        fluid.log("There were errors returned when retrieving records:\n" + JSON.stringify(data.ExceptionMessages, null, 2));
                    }

                    fluid.log("Retrieved ", data.Records.length , " records for ISO code '", myIsoCode, "'...");
                    that.isoRecordLists.push(data.Records);
                }
                catch (e) {
                    fluid.log("Error retrieving records from '" + response.request.uri.href + "':\n");
                }
            }

            promise.resolve();
        });

        return promise;
    };
};

gpii.ul.imports.eastin.downloader.retrieveRecordListsByIsoCode = function (that) {
    var deferrals = [];
    fluid.each(that.options.isoCodes, function (code) {
        deferrals.push(gpii.ul.imports.eastin.downloader.getRetrieveRecordListByIsoCodeFunction(that, code));
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(deferrals, that.options.maxRequests);
    queue.then(function () {
        that.events.onIsoSearchComplete.fire(that);
    }, fluid.fail);

    return queue;
};

gpii.ul.imports.eastin.downloader.retrieveFullRecords = function (that) {
    var deferrals = [];
    var uniqueIds = [];

    fluid.each(that.isoRecordLists, function (records) {
        fluid.each(records, function (record) {
            var id = record.Database + record.ProductCode;
            if (uniqueIds.indexOf(id) === -1) {
                uniqueIds.push(id);

                deferrals.push(function () {
                    var promise = fluid.promise();

                    var options = {
                        "timeout": that.options.detailedRecordTimeout,
                        "url": that.options.urls.detail,
                        qs: {
                            database:    record.Database,
                            productCode: record.ProductCode
                        }
                    };

                    fluid.log("Retrieving detailed record '", record.Database, ":", record.ProductCode, "'...");

                    request(options, function (error, response, body) {
                        // We have to make sure we are being given JSON data because EASTIN returns HTML errors at the moment.
                        try {
                            var data = body && JSON.parse(body);
                            // If we receive an "ExceptionMessage" object, display its contents in the console.
                            if (data && !data.Ok) {
                                fluid.log("Exception returned by EASTIN API:", data.exceptionMessage || data.exceptionMessages);
                            }
                            else if (error) {
                                fluid.log("Error retrieving record:", error);
                            }
                            else if (data.Record) {
                                fluid.log("Detailed record for '", data.Record.Database, ":", data.Record.ProductCode, "' retrieved...");
                                that.originalRecords.push(data.Record);
                            }
                            else {
                                fluid.log("Skipping empty record retrieved from '" + response.request.uri.href + "'...");
                            }
                        }
                        catch (e) {
                            if (response && response.request) {
                                // Ignore "junk" HTML records.
                                fluid.log("Error retrieving record from '" + response.request.uri.href + "':\n", e);
                            }
                            else {
                                fluid.log("Error retrieving record:\n", e);
                            }
                        }
                        promise.resolve();
                    });

                    return promise;
                });
            }
        });
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(deferrals, that.options.maxRequests);
    queue.then(
        function () {
            that.applier.change("records", that.originalRecords);
            that.events.onRecordsRetrieved.fire(that);
        },
        function (error) {
            fluid.log("Error retrieving detailed records...", error);
        }
    );
};

fluid.defaults("gpii.ul.imports.eastin.downloader", {
    gradeNames: ["fluid.modelComponent"],
    members: {
        isoRecordLists:     [],
        originalRecords:    []
    },
    detailedRecordTimeout: 120000, // Timeout in milliseconds
    maxRequests: 150,
    model: {
        records: []
    },
    events: {
        onIsoSearchComplete: null,
        onRecordsRetrieved:  null
    },
    invokers: {
        // TODO: Use an actual dataSource here.
        "get": {
            funcName: "gpii.ul.imports.eastin.downloader.retrieveRecordListsByIsoCode",
            args:     ["{that}"]
        }
    },
    listeners: {
        "onIsoSearchComplete.retrieveRecords": {
            funcName: "gpii.ul.imports.eastin.downloader.retrieveFullRecords",
            args:     ["{that}"]
        }
    }
});
