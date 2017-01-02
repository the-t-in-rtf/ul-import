// A component to transform GARI's data into the format required by the Unified Listing.
"use strict";
var fs      = require("fs");
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");

require("../../../../node_modules/universal/gpii/node_modules/settingsHandlers/index");
require("../transforms");
require("../helpers");

fluid.registerNamespace("gpii.ul.imports.gari.transformer");

// Load and return the text content of a named file.
gpii.ul.imports.gari.transformer.loadData = function (that) {
    var xmlData = fs.readFileSync(that.options.cacheFile, { encoding: "utf8" });
    that.applier.change("xml", xmlData);
};

// Parse the XML data we already have
gpii.ul.imports.gari.transformer.parseXml = function (that) {
    var parsedXml = gpii.settingsHandlers.XMLHandler.parser.parse(that.model.xml, that.options.xmlParserRules);
    var flattenedJson = gpii.ul.imports.transforms.flatten(parsedXml);
    that.applier.change("rawJson", flattenedJson);
};

// Remap the data
gpii.ul.imports.gari.transformer.remapData = function (that) {
    var remappedJson = fluid.transform(that.model.rawJson.products, that.transformData);
    that.applier.change("remappedJson", remappedJson);
};


fluid.defaults("gpii.ul.imports.gari.transformer", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        xml:          {},
        rawJson:      {},
        remappedJson: {}
    },
    cacheFile:   "/tmp/gari.xml",
    semverRegexp: "([0-9]+(\\.[0-9]+){0,2})",
    xmlParserRules: {
        rules: {
            products: "rss.channel.product" // Drill down to only the objects we care about to simplify the transform paths
        }
    },
    mapRules: {
        source: {
            literalValue: "{that}.options.defaults.source"
        },
        sid: "objectid",
        name: "Model",
        description: { literalValue: "{that}.options.defaults.description" },
        manufacturer: {
            name:    "ProductBrand",
            url:     "Website",
            country: "Countries"
        },
        language: {
            literalValue: "{that}.options.defaults.language"
        },
        images: [
            {
                url:         "productpic",
                description: "Model"
            }
        ],
        updated: {
            transform: {
                type: "fluid.transforms.dateToString",
                value: {
                    transform: {
                        type: "fluid.transforms.value",
                        inputPath: "DateCompleted"
                    }
                }
            }
        },
        ontologies: {
            context: {
                id: {
                    transform: {
                        type: "gpii.ul.imports.transforms.toLowerCase",
                        value: {
                            transform: {
                                type: "fluid.transforms.value",
                                inputPath: "Platform"
                            }
                        }
                    }
                },
                version: {
                    transform: {
                        type: "gpii.ul.imports.transforms.regexp",
                        inputPath: "PlatformVersion",
                        regexp: "{that}.options.semverRegexp"
                    }
                }
            }
        },
        sourceData: ""
    },
    defaults: {
        description: "No description available.", // There is no description data, but the field is required, so we set it to a predefined string.
        language:    "en_us", // Their data only contains English language content
        source:      "gari"
    },
    invokers: {
        loadData: {
            funcName: "gpii.ul.imports.gari.transformer.loadData",
            args: ["{that}"]
        },
        parseXml: {
            funcName: "gpii.ul.imports.gari.transformer.parseXml",
            args: ["{that}"]
        },
        remapData: {
            funcName: "gpii.ul.imports.gari.transformer.remapData",
            args: ["{that}"]
        },
        transformData: {
            funcName: "fluid.model.transformWithRules",
            args: ["{arguments}.0", "{that}.options.mapRules"]
        }
    },
    modelListeners: {
        xml: {
            func: "{that}.parseXml",
            excludeSource: "init"
        },
        rawJson: {
            func: "{that}.remapData",
            excludeSource: "init"
        }
    }
});
