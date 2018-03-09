/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff"
    file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");

fluid.require("%gpii-launcher");

require("./html-update-report");

fluid.defaults("gpii.ul.imports.updateReport.launcher", {
    gradeNames: ["gpii.launcher"],
    optionsFile: "%ul-imports/configs/updates-report-prod.json",
    "yargsOptions": {
        "describe": {
            "diffsAndUpdatesPath": "The path (absolute or package-relative) to the 'diffs and updates' JSON file generated for a given import.",
            "outputDir":           "The path (absolute or package-relative) to the directory where the output from this run will be saved.",
            "setLogging":          "Whether to display verbose log messages.  Set to `true` by default."
        },
        required: ["diffsAndUpdatesPath", "outputDir"],
        defaults: {
            "optionsFile": "{that}.options.optionsFile",
            "outputDir":   "{that}.options.outputDir",
            "setLogging":  false
        },
        coerce: {
            "setLogging": JSON.parse
        },
        help: true
    }
});

gpii.ul.imports.updateReport.launcher();
