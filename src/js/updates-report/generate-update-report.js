/*

    Generate an email reporting on a single change to a record in the Unified Listing.

*/
"use strict";
var fluid  = require("infusion");
// TODO: configure this and everything else through a launcher.
fluid.setLogging(true);
var gpii   = fluid.registerNamespace("gpii");

var mkdirp = require("mkdirp");
var fs     = require("fs");
var path   = require("path");

fluid.require("%gpii-handlebars");
fluid.require("%gpii-diff");

require("./urlEncode-helper");

fluid.registerNamespace("gpii.ul.imports.updateReport");

gpii.ul.imports.updateReport.createSummary = function (that) {
    var dateStamp = (new Date()).toISOString();

    var diffs = require(fluid.module.resolvePath(that.options.inputFile));
    var diffsBySource = gpii.ul.imports.updateReport.sortDiffsBySource(diffs);
    // Create our output directory
    var resolvedOutputPath = fluid.module.resolvePath(that.options.outputDir);
    mkdirp(resolvedOutputPath, function (err) {
        if (err) {
            fluid.fail(err);
        }
        else {
            // Copy our required dependencies into the new directory.
            var dependencyPromise = gpii.ul.imports.updateReport.copyDependencies(that);
            dependencyPromise.then(function () {
                // Generate an index.html summary page with links to source pages
                var recordCountBySource = {};
                fluid.each(Object.keys(diffsBySource), function (sourceKey) {
                    recordCountBySource[sourceKey] = diffsBySource[sourceKey].length;
                });
                var overallSummaryHtml = that.renderer.render(that.options.templateKeys.overallSummary, { options: that.options, sources: Object.keys(diffsBySource).sort(), recordCountBySource: recordCountBySource, totalRecords: diffs.length, dateStamp: dateStamp});
                var overallSummaryPath = path.resolve(resolvedOutputPath, "index.html");
                fs.writeFileSync(overallSummaryPath, overallSummaryHtml, { encoding: "utf8" });
                fluid.log("Saved overall summary.");

                gpii.ul.imports.updateReport.createSourceReports(that, diffsBySource, dateStamp);
            }, fluid.fail);
        }
    });
};

gpii.ul.imports.updateReport.copyDependencies = function (that) {
    var resolvedOutputPath = fluid.module.resolvePath(that.options.outputDir);
    fluid.each(that.options.depsToBundle, function (files, depKey) {
        var depSubDir = path.resolve(resolvedOutputPath, depKey);
        mkdirp(depSubDir, function (err) {
            if (err) {
                fluid.fail(err);
            }
            else {
                var promises = [];
                fluid.each(files, function (unresolvedSourcePath) {
                    promises.push(function () {
                        var promise = fluid.promise();
                        var sourcePath = fluid.module.resolvePath(unresolvedSourcePath);
                        var filename = path.basename(sourcePath);
                        var destinationPath = path.resolve(depSubDir, filename);
                        try {
                            var readStream = fs.createReadStream(sourcePath);
                            var writeStream = fs.createWriteStream(destinationPath);
                            readStream.pipe(writeStream);
                            promise.resolve();
                        }
                        catch (err) {
                            promise.reject(err);
                        }

                        return promise;
                    });
                    var sequence = fluid.promise.sequence(promises);
                    return sequence;
                });
            }
        });
    });

    var emptyPromise = fluid.promise();
    emptyPromise.resolve();
    return emptyPromise;
};

gpii.ul.imports.updateReport.createSourceReports = function (that, diffsBySource, dateStamp) {
    var resolvedOutputPath = fluid.module.resolvePath(that.options.outputDir);
    fluid.each(Object.keys(diffsBySource), function (source) {
        var sourceOutputPath = path.resolve(resolvedOutputPath, source);
        // Create a subdirectory for this source.
        mkdirp(sourceOutputPath, function (err) {
            if (err) {
                fluid.fail(err);
            }
            else {
                // Create an summary page for this source.
                var sourceSummaryHtml = that.renderer.render(that.options.templateKeys.sourceSummary, { options: that.options, source: source, diffs: diffsBySource[source], dateStamp: dateStamp });
                var sourceSummaryPath = path.resolve(sourceOutputPath, "summary.html");
                fs.writeFileSync(sourceSummaryPath, sourceSummaryHtml, "utf8");
                fluid.log("Saved source summary for source '", source, "'.");

                var sourceAllUpdatesHtml = that.renderer.render(that.options.templateKeys.sourceAllUpdates, { options: that.options, source: source, diffs: diffsBySource[source], dateStamp: dateStamp });
                var sourceAllUpdatesPath = path.resolve(sourceOutputPath, "all-updates.html");
                fs.writeFileSync(sourceAllUpdatesPath, sourceAllUpdatesHtml, "utf8");
                fluid.log("Saved combined 'all updates' report for source '", source, "'.");

                // Create a page for each record that links back to the source and overall summaries.
                fluid.each(diffsBySource[source], function (diff) {
                    var sid = diff.sid[0].value;
                    var individualdiffFilename = source + "-" + encodeURIComponent(sid) + ".html";
                    var individualDiffHtml     = that.renderer.render(that.options.templateKeys.singleRecord, { options: that.options, diff: diff, dateStamp: dateStamp });
                    var individualDiffPath     = path.resolve(sourceOutputPath, individualdiffFilename);
                    fs.writeFileSync(individualDiffPath, individualDiffHtml, "utf8");
                });
                fluid.log("Saved ", diffsBySource[source].length, " individual records for source '", source, "'.");
            }

            fluid.log("Finished generating updates report, output saved to '", resolvedOutputPath, "'.");
        });
    });
};

gpii.ul.imports.updateReport.sortDiffsBySource = function (diffs) {
    var diffsBySource = {};
    fluid.each(diffs, function (diff) {
        var source = diff.source[0].value;
        if (!diffsBySource[source]) { diffsBySource[source] = []; }
        diffsBySource[source].push(diff);
    });
    return diffsBySource;
};

gpii.ul.imports.updateReport.generateUniqueSubdir = function (that, baseOutputDir) {
    var uniqueDirName = "updates-report-" + that.id;
    return path.resolve(baseOutputDir, uniqueDirName);
};

fluid.defaults("gpii.ul.imports.updateReport", {
    gradeNames: ["fluid.component"],
    // TODO: Make these configurable via a launcher
    templateKeys: {
        overallSummary:    "overall-updates-summary",
        sourceSummary:     "source-updates-summary",
        sourceAllUpdates:  "source-all-updates",
        singleRecord:      "single-update-page"
    },
    depsToBundle: {
        css: ["%gpii-diff/src/css/gpii-diff.css", "%ul-imports/src/css/ul-imports.css","%ul-imports/node_modules/foundation-sites/dist/css/foundation.css"],
        js:  ["%infusion/dist/infusion-all.js", "%infusion/dist/infusion-all.js.map", "%ul-imports/src/js/client/toggleAllDetails.js"]
    },
    baseOutputDir: "/tmp",
    outputDir: "@expand:gpii.ul.imports.updateReport.generateUniqueSubdir({that}, {that}.options.baseOutputDir)",
    inputFile: "/srv/ul-logs/2017-11-22T10:58:49.857Z-eastin-updatedRecordDiffs-7pcxclrx-151.json",
    components: {
        renderer: {
            type: "gpii.handlebars.standaloneRenderer",
            options: {
                templateDirs: ["%ul-imports/src/templates", "%gpii-diff/src/templates"],
                components: {
                    isDiffArray: {
                        type: "gpii.diff.helper.isDiffArray"
                    },
                    urlEncode: {
                        type: "gpii.ul.imports.helpers.urlEncode"
                    },
                    md: {
                        options: {
                            markdownitOptions: {
                                html: true
                            }
                        }
                    }
                }
            }
        }
    },
    listeners: {
        "onCreate.createSummary": {
            funcName: "gpii.ul.imports.updateReport.createSummary",
            args:     ["{that}"]
        }
    }
});

// TODO: Write a launcher or provide another means to run this.
gpii.ul.imports.updateReport();
