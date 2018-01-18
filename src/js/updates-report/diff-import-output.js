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

fluid.require("%gpii-diff");
gpii.diff.loadMarkdownSupport();

fluid.registerNamespace("gpii.ul.imports.diffImportResults");
gpii.ul.imports.diffImportResults.generateOutputPath = function (that, baseDir) {
    return path.resolve(baseDir, (new Date()).toISOString() + "-diffsAndUpdates-" + that.id + ".json");
};

gpii.ul.imports.diffImportResults.generateDiff = function (originalsPath, updatesPath, diffFieldsToCompare, outputPath) {
    var diffsAndUpdates = [];
    var originals = require(fluid.module.resolvePath(originalsPath));
    var originalsBySourceAndSid = {};
    fluid.each(originals, function (originalRecord) {
        fluid.set(originalsBySourceAndSid, originalRecord.source + "." + originalRecord.sid, originalRecord);
    });

    var updates   = require(fluid.module.resolvePath(updatesPath));
    fluid.each(updates, function (updatedRecord) {
        var originalRecord = fluid.get(originalsBySourceAndSid, updatedRecord.source + "." + updatedRecord.sid);
        if (originalRecord !== undefined) {
            fluid.log("diffing ", originalRecord.source, ":", originalRecord.sid);
            var filteredOriginalRecord = fluid.filterKeys(originalRecord, diffFieldsToCompare);
            var filteredUpdatedRecord = fluid.filterKeys(updatedRecord, diffFieldsToCompare);
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
        var resolvedOutputPath = fluid.module.resolvePath(outputPath);

        fs.writeFileSync(resolvedOutputPath, JSON.stringify(diffsAndUpdates, null, 2), { encoding: "utf8"});

        fluid.log("Saved " + diffsAndUpdates.length + " diffs and updated records to '" + resolvedOutputPath + "'...");
    }
    else {
        fluid.log("No updates to process.");
    }

};

gpii.ul.imports.diffImportResults.defaultFieldsToCompare = ["manufacturer", "description", "name", "uid", "sid", "source", "sourceUrl"];

fluid.defaults("gpii.ul.imports.diffImportResults", {
    gradeNames: ["fluid.component"],
    outputDir:   os.tmpdir(),
    outputPath:  "@expand:gpii.ul.imports.diffImportResults.generateOutputPath({that}, {that}.options.outputDir)",
    diffFieldsToCompare: gpii.ul.imports.diffImportResults.defaultFieldsToCompare,
    listeners: {
        "onCreate.generateDiff": {
            funcName: "gpii.ul.imports.diffImportResults.generateDiff",
            args:     ["{that}.options.originalsPath", "{that}.options.updatesPath", "{that}.options.diffFieldsToCompare", "{that}.options.outputPath"] // originalsPath, updatesPath, diffFieldsToCompare, outputPath
        }
    }
});

