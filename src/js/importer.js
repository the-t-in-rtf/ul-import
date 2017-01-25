"use strict";
var fluid = require("infusion");

var gpii  = fluid.registerNamespace("gpii");

var os     = require("os");
var path   = require("path");
var tmpDir = path.resolve(os.tmpDir());

fluid.require("%ul-imports");
fluid.require("%kettle");

require("./cacher");
require("./launcher");
require("./syncer");
require("./transformer");

fluid.registerNamespace("gpii.ul.imports.importer");

// Check to see if we have cached data.
gpii.ul.imports.importer.checkCache = function (that) {
    // If so, require it and continue.
    if (gpii.ul.imports.cacher.cacheFileExists(that)) {
        var cachedData = gpii.ul.imports.cacher.loadFromCache(that);
        that.applier.change("rawData", cachedData);
    }
    // Otherwise, download it.
    else {
        var promise = that.downloader.get();
        promise.then(that.saveData, fluid.fail);
    }
};

gpii.ul.imports.importer.saveDownload = function (that, data) {
    that.applier.change("rawData", data);
};

fluid.defaults("gpii.ul.imports.importer", {
    gradeNames: ["fluid.modelComponent"],
    setLogging: false,
    cacheDir:   tmpDir,
    cacheFilename: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["importer-%id.json", { id: "{that}.id" }]
        }
    },
    cacheFile:  {
        expander: {
            funcName: "path.resolve",
            args: ["{that}.options.cacheDir", "{that}.options.cacheFilename"]
        }
    },
    model: {
        rawData:       "{transformer}.model.rawJson",
        processedData: "{transformer}.model.transformedJson"
    },
    invokers: {
        "saveData": {
            funcName: "gpii.ul.imports.importer.saveDownload",
            args:     ["{that}", "{arguments}.0"]

        }
    },
    components: {
        downloader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.importer}.options.urls.sai"
            }
        },
        transformer: {
            type: "gpii.ul.imports.transformer"
        },
        syncer: {
            type: "gpii.ul.imports.syncer",
            options: {
                source:   "{gpii.ul.imports.importer}.options.source",
                username: "{gpii.ul.imports.importer}.options.username",
                password: "{gpii.ul.imports.importer}.options.password",
                urls:     "{gpii.ul.imports.importer}.options.urls",
                model: {
                    data: "{transformer}.model.transformedJson"
                }
            }
        }
    },
    listeners: {
        "onCreate.setLogging": {
            priority: "first",
            funcName: "fluid.setLogging",
            args:     ["{that}.options.setLogging"]
        },
        "onCreate.checkCache": {
            funcName: "gpii.ul.imports.importer.checkCache",
            args:     ["{that}"]
        }
    },
    modelListeners: {
        // Save the raw data to the cache
        "rawData": {
            funcName:      "gpii.ul.imports.cacher.saveToCache",
            args:          ["{that}", "{that}.model.rawData"],
            excludeSource: "init"
        }
    }
});
