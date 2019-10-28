/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.ableData.transformer");

gpii.ul.imports.ableData.transformer.transformRawJson = function (that) {
    var remappedJson = fluid.transform(that.model.rawJson, function (singleRecord) {
        return fluid.model.transformWithRules(singleRecord, that.options.rules);
    });
    that.applier.change("remappedJson", remappedJson);
};

fluid.defaults("gpii.ul.imports.ableData.transformer", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        rawJson:      {},
        remappedJson: {}
    },
    rules: {
        status: {
            transform: {
                type: "fluid.transforms.valueMapper",
                defaultInputPath: "Product-Status",
                match: {
                    "Discontinued": "discontinued"
                },
                noMatch: {
                    outputValue: "new"
                }
            }
        },
        source: {
            literalValue: "{that}.options.defaults.source"
        },
        sid: {
            transform: {
                type: "gpii.ul.imports.ableData.transforms.extractProductSid",
                inputPath: "Link-to-Product-Page"
            }
        },
        name: {
            transform: {
                type: "gpii.ul.imports.ableData.transforms.extractTitle",
                inputPath: "Title"
            }
        },
        description: {
            transform: {
                type: "gpii.ul.imports.transforms.extractDescription",
                input: {
                    transform: {
                        type: "fluid.transforms.firstValue",
                        values: [
                            "Description.$cd",
                            "Description"
                        ]
                    }
                }
            }
        },
        manufacturer: {
            name:    {
                transform: {
                    type: "fluid.transforms.firstValue",
                    values: [
                        "Maker",
                        { transform: { type: "fluid.transforms.literalValue", input: "Manufacturer Unknown"}}
                    ]
                }
            }
        },
        updated: {
            transform: {
                type: "gpii.ul.imports.ableData.transforms.extractLastUpdated",
                inputPath: "Product-information-last-updated"
            }
        },
        sourceUrl: {
            transform: {
                type: "gpii.ul.imports.ableData.transforms.extractProductLink",
                inputPath: "Link-to-Product-Page"
            }
        },
        // Lightly massage their raw record to include sane titles, parsed category data, etc.
        sourceData: {
            "": "",
            Title: {
                transform: {
                    type: "gpii.ul.imports.ableData.transforms.extractTitle",
                    inputPath: "Title"
                }
            },
            Description: {
                transform: {
                    type: "gpii.ul.imports.transforms.extractDescription",
                    input: {
                        transform: {
                            type: "fluid.transforms.firstValue",
                            values: [
                                "Description.$cd",
                                "Description"
                            ]
                        }
                    }
                }
            },
            "Product-information-last-updated": {
                transform: {
                    type: "gpii.ul.imports.ableData.transforms.extractLastUpdated",
                    inputPath: "Product-information-last-updated"
                }
            },
            "Link-to-Product-Page": {
                transform: {
                    type: "gpii.ul.imports.ableData.transforms.extractProductLink",
                    inputPath: "Link-to-Product-Page"
                }
            }
        }
    },
    defaults: {
        description: "No description available.", // There is no description data, but the field is required, so we set it to a predefined string.
        language:    "en_us", // Their data only contains English language content
        source:      "AbleData"
    },
    modelListeners: {
        rawJson: {
            excludeSource: "init",
            funcName: "gpii.ul.imports.ableData.transformer.transformRawJson",
            args: ["{that}"]
        }
    }
});
