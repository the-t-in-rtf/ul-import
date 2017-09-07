/*

    Look for "merged" unified records and transfer any associated images to the associated "original" unified record.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii = fluid.registerNamespace("gpii");

var request = require("request");
var fs      = require("fs");
var path    = require("path");
require("../launcher");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.curation.mergeImages");

gpii.ul.imports.curation.mergeImages.getMergedRecords = function (that) {
    var requestOptions = {
        url: that.options.urls.ulDb + "/_design/ul/_view/merged",
        json: true
    };
    request.get(requestOptions, that.handleMergedRecordLookupResults);
};

gpii.ul.imports.curation.mergeImages.handleMergedRecordLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        // Stash duplicate sid -> original uid data as a member variable.
        var targetsByDuplicateSid = {};
        fluid.each(body.rows, function (row) {
            targetsByDuplicateSid[row.value.sid] = row.value.uid;
        });
        that.targetsByDuplicateSid = targetsByDuplicateSid;

        var uniqueDuplicateSids = Object.keys(targetsByDuplicateSid);
        that.uniqueDuplicateSids = uniqueDuplicateSids;
        gpii.ul.imports.curation.mergeImages.getImageRecords(that);
    }
};

gpii.ul.imports.curation.mergeImages.getImageRecords = function (that) {
    // TODO: Once we have a "write" API for images, refactor this.
    // TODO: Break this up into a sequence of batches if we end up with more than 750 or so duplicates.
    var requestOptions = {
        url: that.options.urls.imageDb + "/_design/metadata/_view/byUid?keys=" + JSON.stringify(that.uniqueDuplicateSids),
        json: true
    };
    request.get(requestOptions, that.handleImageLookupResults);
};


gpii.ul.imports.curation.mergeImages.handleImageLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        // Construct a bulk update for the image metadata.
        var updatedRecords = fluid.transform(body.rows, function (row) {
            var updatedValue = fluid.copy(row.value);
            var targetUid = that.targetsByDuplicateSid[row.value.uid];
            if (targetUid) {
                updatedValue.uid = targetUid;
            }
            return updatedValue;
        });

        if (updatedRecords.length) {
            fluid.log("Found ", updatedRecords.length , " image records associated with merged unified records...");

            var requestOptions = {
                url: that.options.urls.bulkImages,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ docs: updatedRecords }, null, 2)
            };
            request.post(requestOptions, that.handleBulkUpdateResults);
        }
        else {
            fluid.log("There are no image records associated with merged unified records...");
        }
    }
};

gpii.ul.imports.curation.mergeImages.handleBulkUpdateResults = function (that, error) {
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.log("Image metadata updated...");
        fluid.log("Relocating filesystem content...");
        var promises = [];
        // Relocate all images for each duplicate.
        fluid.each(that.targetsByDuplicateSid, function (targetUid, duplicateSid) {
            promises.push(function () {
                var promise = fluid.promise();
                var targetPath    = path.resolve(that.options.originalsDir, targetUid);
                var duplicatePath = path.resolve(that.options.originalsDir, duplicateSid);
                fs.rename(duplicatePath, targetPath, function (error) {
                    if (error) {
                        promise.reject(error);
                    }
                    else {
                        promise.resolve();
                    }
                });
                return promise;
            });
        });
        var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

        queue.then(function () {
            fluid.log("Relocated image content from " + promises.length + " duplicates...");
        }, fluid.fail);
    }
};

fluid.defaults("gpii.ul.imports.curation.mergeImages", {
    gradeNames: ["fluid.component"],
    members: {
        existingUids: [],
        targetsByDuplicateSid: {}
    },
    maxRequests: 100,
    invokers: {
        "handleMergedRecordLookupResults": {
            funcName: "gpii.ul.imports.curation.mergeImages.handleMergedRecordLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "handleImageLookupResults": {
            funcName: "gpii.ul.imports.curation.mergeImages.handleImageLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "handleBulkUpdateResults": {
            funcName: "gpii.ul.imports.curation.mergeImages.handleBulkUpdateResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.getMergedRecords": {
            funcName: "gpii.ul.imports.curation.mergeImages.getMergedRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.mergeImages.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-mergeImages-prod.json",
    "yargsOptions": {
        "describe": {
            "setLogging": "The logging level to use.  Set to `true` by default."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.curation.mergeImages.launcher();
