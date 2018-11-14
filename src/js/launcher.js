"use strict";
var fluid = require("infusion");

fluid.require("%gpii-launcher");
fluid.require("%ul-imports");

fluid.defaults("gpii.ul.imports.launcher", {
    gradeNames: ["gpii.launcher"],
    optionsFile: "%ul-imports/configs/base-prod.json",
    filterKeys: false,
    yargsOptions: {
        env: true,
        describe: {
            "username":       "The username to use when adding/updating records",
            "password":       "The password to use when adding/updating records",
            "ports.api":      "The port where the UL API is available",
            "ports.couch":    "The port where CouchDB/PouchDB is available",
            "ports.smtp":     "The port where the mail server is available",
            "hosts.api":      "The hostname where the UL API is available",
            "hosts.couch":    "The hostname where CouchDB/PouchDB is available",
            "hosts.smtp":     "The hostname where the mail server is available",
            "couchAuthCreds": "The auth credentials to pass as part of CouchDB URLs",
            "noCache":        "Pass this argument to force a download regardless of whether there is a cached copy available.",
            "setLogging":     "The logging level to use.  Set to `false` (only errors and warnings) by default."
        },
        defaults: {
            "setLogging":  false,
            "optionsFile": "{that}.options.optionsFile"
        },
        coerce: {
            "setLogging": JSON.parse
        },
        help: true
    }
});
