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
            "username":       "The username to use when adding/updating records.",
            "password":       "The password to use when adding/updating records.",
            "ports.api":      "The port where the UL API is available.",
            "ports.couch":    "The port where CouchDB/PouchDB is available.",
            "couchAuthCreds": "The auth credentials to pass as part of CouchDB URLs"
        },
        defaults: {
            "setLogging":  true,
            "optionsFile": "{that}.options.optionsFile"
        },
        help: true
    }
});
