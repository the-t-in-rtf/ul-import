/*

    A script to generate a JSON file that represents the differences introduced by updates in a particular import. Used
    to generate "updates" reports to be delivered via email.

    You will need to supply an `updatesPath` and `originalsPath` when launching this script.  Look for lines like the
    following in your import logs:

    11:39:34.207:  Saved 560 preupdateOriginals records to '/srv/ul-logs/2017-11-29T10:39:34.158Z-eastin-preupdateOriginals-1xc4nlp8-151.json'...
    11:39:34.255:  Saved 560 updatedRecords records to '/srv/ul-logs/2017-11-29T10:39:34.207Z-eastin-updatedRecords-1xc4nlp8-151.json'...

    `originalsPath` is the path on the first line, `updatesPath` is the path on the second.

*/
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var fs   = require("fs");
var os   = require("os");
var path = require("path");

fluid.require("%gpii-launcher");
fluid.require("%gpii-diff");
gpii.diff.loadMarkdownSupport();

fluid.registerNamespace("gpii.ul.imports.diffImportResults");
gpii.ul.imports.diffImportResults.generateOutputPath = function (that, baseDir) {
    return path.resolve(baseDir, (new Date()).toISOString() + "-diffsAndUpdates-" + that.id + ".json");
};

gpii.ul.imports.diffImportResults.generateDiff = function (that) {
    var diffsAndUpdates = [];
    var originals = require(fluid.module.resolvePath(that.options.originalsPath));
    var originalsBySourceAndSid = {};
    fluid.each(originals, function (originalRecord) {
        fluid.set(originalsBySourceAndSid, originalRecord.source + "." + originalRecord.sid, originalRecord);
    });

    var updates   = require(fluid.module.resolvePath(that.options.updatesPath));
    fluid.each(updates, function (updatedRecord) {
        var originalRecord = fluid.get(originalsBySourceAndSid, updatedRecord.source + "." + updatedRecord.sid);
        if (originalRecord !== undefined) {
            fluid.log("diffing ", originalRecord.source, ":", originalRecord.sid);
            var filteredOriginalRecord = fluid.filterKeys(originalRecord, that.options.diffFieldsToCompare);
            var filteredUpdatedRecord = fluid.filterKeys(updatedRecord, that.options.diffFieldsToCompare);
            if (!gpii.diff.equals(filteredOriginalRecord, filteredUpdatedRecord)) {
                var diff = gpii.diff.compare(
                    filteredOriginalRecord,
                    filteredUpdatedRecord,
                    { compareStringsAsMarkdown: true, markdownItOptions: { html: true }, lcsOptions: { tracebackStrategy: "full", timeout: 30000 }}
                );
                diffsAndUpdates.push({ diff: diff, update: updatedRecord});
            }
        }
    });

    if (diffsAndUpdates.length) {
        var outputPath = fluid.module.resolvePath(that.options.outputPath);

        fs.writeFileSync(outputPath, JSON.stringify(diffsAndUpdates, null, 2), { encoding: "utf8"});

        fluid.log("Saved " + diffsAndUpdates.length + " diffs and updated records to '" + outputPath + "'...");
    }
    else {
        fluid.log("No updates to process.");
    }

};

fluid.defaults("gpii.ul.imports.diffImportResults", {
    gradeNames: ["fluid.component"],
    outputDir:   os.tmpdir(),
    outputPath:  "@expand:gpii.ul.imports.diffImportResults.generateOutputPath({that}, {that}.options.outputDir)",
    diffFieldsToCompare: ["manufacturer", "description", "name", "status", "uid", "sid", "source", "sourceUrl"],
    listeners: {
        "onCreate.generateDiff": {
            funcName: "gpii.ul.imports.diffImportResults.generateDiff",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.diffImportResults.launcher", {
    gradeNames:  ["gpii.launcher"],
    optionsFile: "%ul-imports/configs/updates-diff.json",
    "yargsOptions": {
        "describe": {
            "updatesPath":   "The path (absolute or package-relative) to the updated versions of records that were updated in a given import.",
            "originalsPath": "The path (absolute or package-relative) to the original versions of records that were updated in a given import.",
            "outputPath":    "The path (absolute or package-relative) where the output from this run will be saved.",
            "setLogging":    "Whether to display verbose log messages.  Set to `true` by default."
        },
        required: ["updatesPath", "originalsPath", "outputPath"],
        defaults: {
            "optionsFile": "{that}.options.optionsFile",
            "outputPath": "{that}.options.outputPath",
            "setLogging":  true
        },
        coerce: {
            "setLogging": JSON.parse
        },
        help: true
    }
});

gpii.ul.imports.diffImportResults.launcher();
