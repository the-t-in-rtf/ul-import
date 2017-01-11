"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii  = fluid.registerNamespace("gpii");

var os   = require("os");
var path = require("path");
var cacheFile = path.resolve(os.tmpDir(), "sai.json");

require("kettle");

require("../cacher");
require("../deepEq");
require("../launcher");
require("../syncer");

fluid.registerNamespace("gpii.ul.imports.sai");

// Check to see if we have cached data.
gpii.ul.imports.sai.checkCache = function (that) {
    // If so, require it and continue.
    if (gpii.ul.imports.cacher.cacheFileExists(that)) {
        var records = gpii.ul.imports.cacher.loadFromCache(that);
        fluid.log("Loaded " + records.length + " records from cache....");
        that.applier.change("rawData", records);
    }
    // Otherwise, download it.
    else {
        that.downloader.get();
    }
};

/*

Transform a raw SAI record, which should look something like:

{
    "uid": "1421059432806-10523262",
    "body": "<p>Range of stickers for QWERTY keyboard, with large digits, 'space', 'enter', black on yellow or white, white on black.</p>\n",
    "needs": [
        {
            "tid": "3130"
        },
        {
            "tid": "3149"
        },
        {
            "tid": "921"
        },
        {
            "tid": "182"
        }
    ],
    "product_image": {
        "fid": "2108",
        "uid": "1",
        "filename": "product-default-thumb.png",
        "uri": "public://default_images/product-default-thumb.png",
        "filemime": "image/png",
        "filesize": "3550",
        "status": "1",
        "timestamp": "1481666668",
        "origname": "product-default-thumb.png",
        "is_default": true
    },
    "product_category": [
        {
            "tid": "3629"
        },
        {
            "tid": "3637"
        }
    ],
    "title": "Keyboard Stickers",
    "nid": "20"
},
 */

fluid.registerNamespace("gpii.ul.imports.sai.transformer");

// We could have written this using invokers, but a small function makes it easier to debug.
gpii.ul.imports.sai.transformer.transformAndSave = function (that) {
    var transformedRecords = that.transform();
    that.applier.change("transformedJson", transformedRecords);
};

fluid.defaults("gpii.ul.imports.sai.transformer.firstSaneValue", {
    gradeNames: "fluid.standardOutputTransformFunction"
});

// This function is required because undefined values are represented as empty arrays in the SAI.
gpii.ul.imports.sai.transformer.firstSaneValue = function (transformSpec, transformer) {
    var sanitizedTransformSpec = fluid.copy(transformSpec);

    sanitizedTransformSpec.values = fluid.transform(sanitizedTransformSpec.values, function (value) {
        var expanded = transformer.expand(value);

        if (expanded === "" || gpii.ul.imports.deepEq([], expanded)) {
            return "notfound";
        }
        else {
            return value;
        }
    });

    return fluid.transforms.firstValue(sanitizedTransformSpec, transformer);
};

// Transform the downloaded results
fluid.defaults("gpii.ul.imports.sai.transformer", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        rawJson:         [],
        transformedJson: []
    },
    //   "required": ["description", "manufacturer", "name", "sid", "source", "status"],
    rules: {
        "uid": {
            transform: {
                type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                values: [ "uid"]
            }
        },
        "name": "title",
        "description": {
            transform: {
                type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                values: [ "body", "title" ]
            }
        },
        "source": { literalValue: "sai" },
        "sid": "nid",
        "manufacturer": {
            transform: {
                type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                values: [ "manufacturer", { literalValue: { name: "Unknown" } } ]
            }
        },
        "sourceData": ""
    },
    invokers: {
        transform: {
            funcName: "fluid.transform",
            args:     ["{that}.model.rawJson", "{that}.transformOne"]
        },
        transformOne: {
            funcName: "fluid.model.transformWithRules",
            args:     ["{arguments}.0", "{that}.options.rules"]
        }
    },
    modelListeners: {
        rawJson: {
            funcName:      "gpii.ul.imports.sai.transformer.transformAndSave",
            args:          ["{that}"],
            excludeSource: "init"
        }
    }
});

gpii.ul.imports.sai.saveDownload = function (that, data) {
    that.applier.change("rawData", data);
};

fluid.defaults("gpii.ul.imports.sai", {
    gradeNames: ["fluid.modelComponent"],
    cacheFile:  cacheFile,
    model: {
        rawData:       "{transformer}.model.rawJson",
        processedData: "{transformer}.model.transformedJson"
    },
    components: {
        downloader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.sai}.options.urls.sai",
                listeners: {
                    "onRead.saveData": {
                        funcName: "gpii.ul.imports.sai.saveDownload",
                        args:     ["{gpii.ul.imports.sai}", "{arguments}.0"]

                    },
                    "onError.fail": {
                        funcName: "fluid.fail"
                    }
                }
            }
        },
        transformer: {
            type: "gpii.ul.imports.sai.transformer"
        },
        syncer: {
            type: "gpii.ul.imports.syncer",
            options: {
                source:   "{gpii.ul.imports.sai}.options.source",
                username: "{gpii.ul.imports.sai}.options.username",
                password: "{gpii.ul.imports.sai}.options.password",
                model: {
                    data: "{transformer}.model.transformedJson"
                }
            }
        }
    },
    listeners: {
        "onCreate.checkCache": {
            funcName: "gpii.ul.imports.sai.checkCache",
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

fluid.defaults("gpii.ul.imports.sai.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-import/configs/sai-dev.json",
    "yargsOptions": {
        "describe": {
            "username":  "The username to use when writing records to the UL.",
            "password":  "The password to use when writing records to the UL.",
            "source":    "The UL source to sync records with.",
            "urls.sai":  "The URL to use when retrieving records from the SAI."
        }
    }
});

gpii.ul.imports.sai.launcher();
