// Transform EASTIN data into the common format used by the Unified Listing
"use strict";
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");

require("../transforms");
require("../helpers");

fluid.registerNamespace("gpii.ul.imports.eastin.transformer");

// Remap the data
gpii.ul.imports.eastin.transformer.remapData = function (that) {
    var remappedJson = fluid.transform(that.model.rawJson, that.transformData);
    var strippedJson = gpii.ul.imports.transforms.stripNonValues(remappedJson);
    that.applier.change("remappedJson", strippedJson);
};

// Transform to look up the predefined language for each EASTIN data source
fluid.registerNamespace("gpii.ul.imports.eastin.transforms");
gpii.ul.imports.eastin.transformer.lookupLanguage = function (rawValue, transformSpec) {
    if (!transformSpec.databases) {
        fluid.fail("You must pass a databases option to use this transform.");
    }

    // TODO:  Remove this once we are sure we are no longer storing null records when communication fails.
    if (!transformSpec.databases[rawValue]) {
        fluid.log("No configuration found for database '" + rawValue + "', defaulting to US english...");
        return null;
    }

    return transformSpec.databases[rawValue].language;
};

// TODO:  Determine if this is still useful and wire it in as a transform if we still need to clean up these values
gpii.ul.imports.eastin.transformer.standardizeIsoCode = function (code) {
    if (!code) {
        return code;
    }

    return code.match(/\./) ? code : code.replace(/(\d\d)(\d\d)(\d\d)/, "$1.$2.$3");
};

fluid.defaults("gpii.ul.imports.eastin.transformer", {
    gradeNames: ["fluid.modelComponent"],
    defaultValues: {
        description: "No description available."
    },
    model: {
        rawJson:      {},
        remappedJson: {}
    },
    mapRules: {
        source:      "Database",
        sid:         "ProductCode",
        name:        "CommercialName",
        description: {
            transform: {
                type: "fluid.transforms.firstValue",
                values: [
                    {
                        transform: {
                            type:      "fluid.transforms.value",
                            inputPath: "EnglishDescription"
                        }
                    },
                    "{that}.options.defaultValues.description"
                ]
            }
        },
        manufacturer: {
            name:       "ManufacturerOriginalFullName",
            url:        "ManufacturerWebSiteUrl",
            country:    "ManufacturerCountry",
            address:    "ManufacturerAddress",
            postalCode: "ManufacturerPostalCode",
            cityTown:   "ManufacturerTown",
            phone:      "ManufacturerPhone",
            email:      "ManufacturerEmail"
        },
        language: {
            transform: {
                type:      "gpii.ul.imports.eastin.transformer.lookupLanguage",
                value: {
                    transform: {
                        type:      "fluid.transforms.value",
                        inputPath: "Database"
                    }
                },
                databases: "{that}.options.databases"
            }
        },
        images: [
            {
                url:         "ImageUrl",
                description: "EnglishDescription"
            }
        ],
        updated: {
            transform: {
                type: "fluid.transforms.dateToString",
                value: {
                    transform: {
                        type:      "fluid.transforms.value",
                        inputPath: "LastUpdateDate"
                    }
                }
            }
        },
        ontologies: {
            iso9999: {
                IsoCodePrimary:    "IsoCodePrimary",
                IsoCodesSecondary: "IsoCodesSecondary"
            }
        },
        sourceData: ""
    },
    invokers: {
        remapData: {
            funcName: "gpii.ul.imports.eastin.transformer.remapData",
            args:     ["{that}"]
        },
        transformData: {
            funcName: "fluid.model.transformWithRules",
            args:     ["{arguments}.0", "{that}.options.mapRules"]
        },
        lookupLanguage: {
            funcName: "gpii.ul.imports.eastin.transformer.lookupLanguage",
            args:     ["{that}", "{arguments}.0"]
        }
    },
    modelListeners: {
        rawJson: {
            func: "{that}.remapData",
            excludeSource: "init"
        }
    }
});
