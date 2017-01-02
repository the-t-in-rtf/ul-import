// The combined "runner" component for EASTIN imports.  Wires together the common components so that they operate in
// sequence, as follows:
//
// 1. If there is cached data, it is loaded, and we proceed to step 4.  If there is no cached data, we proceed to step 2.
// 2. Retrieve the full list of records for each ISO code.
// 3. Retrieve the full data for each unique record.
// 4. Transform the data
// 5. Synchronize the transformed records with the database.
// 6. Display summary statistics about this run.
//
// Step 1 is handled by the `cacher` static functions.  Steps 2 and 3 are handled by the `downloader` component.  Step 4 is
// handled by the `transformer` component.  Step 5 is handled by the `syncer` components.  Step 6 is handled by the
// `stats` component.
//
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.eastin.runner");

require("../cacher");
require("../syncer");
require("./transformer");
require("./downloader");
require("./stats");

var os   = require("os");
var path = require("path");
var cacheFile = path.resolve(os.tmpDir(), "eastin.json");

gpii.ul.imports.eastin.runner.checkCache = function (that) {
    fluid.log("Checking for cache file...");

    // If we can, load data from the cache.
    if (gpii.ul.imports.cacher.cacheFileExists(that)) {
        var records = gpii.ul.imports.cacher.loadFromCache(that);
        that.applier.change("rawData", records);
    }
    // Otherwise, download it.
    else {
        that.downloader.download();
    }
};

fluid.defaults("gpii.ul.imports.eastin.runner", {
    gradeNames: [ "fluid.modelComponent"],
    cacheFile:  cacheFile,
    model: {
        rawData:       "{transformer}.model.rawJson",
        processedData: "{transformer}.model.remappedJson"
    },
    components: {
        downloader: {
            type: "gpii.ul.imports.eastin.downloader",
            options: {
                urls:     "{runner}.options.urls",
                isoCodes: "{runner}.options.isoCodes",
                model: {
                    records: "{transformer}.model.rawJson"
                }
            }
        },
        transformer: {
            type: "gpii.ul.imports.eastin.transformer",
            options: {
                databases: "{runner}.options.databases"
            }
        },
        syncer: {
            type: "gpii.ul.imports.syncer",
            options: {
                loginUsername: "eastin",
                loginPassword: "yeAw9If4vos2ghe",
                model: {
                    data: "{transformer}.model.remappedJson"
                }
            }
        },
        stats: {
            type: "gpii.ul.imports.eastin.stats",
            options: {
                model: {
                    data: "{transformer}.model.remappedJson"
                }
            }
        }
    },
    listeners: {
        "onCreate.checkCache": {
            funcName: "gpii.ul.imports.eastin.runner.checkCache",
            args:     ["{that}"]
        }
    },
    modelListeners: {
        "rawData": {
            funcName:      "gpii.ul.imports.cacher.saveToCache",
            args:          ["{that}", "{that}.model.rawData"],
            excludeSource: "init"
        }
    }
});
