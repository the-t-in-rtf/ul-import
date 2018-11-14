/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff" file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii  = fluid.registerNamespace("gpii");

require("./mail-update-report");

fluid.require("%gpii-launcher");

fluid.defaults("gpii.ul.imports.mailUpdateReport.launcher", {
    gradeNames: ["gpii.launcher"],
    optionsFile: "%ul-imports/configs/updates-email.json",
    filterKeys: false,
    "yargsOptions": {
        env: true,
        "describe": {
            "diffsAndUpdatesPath": "The path (absolute or package-relative) to the 'diffs and updates' JSON file generated for a given import.",
            "outputDir":           "The path (absolute or package-relative) to the directory where the output from this run will be saved.",
            "setLogging":          "Whether to display verbose log messages.  Set to `true` by default.",
            "smtpPort":            "The mail server port to use when sending outgoing messages."
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

gpii.ul.imports.mailUpdateReport.launcher();
