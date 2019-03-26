// A component to transform AbleData's data into the format required by the Unified Listing.
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii  = fluid.registerNamespace("gpii");

require("gpii-universal");
fluid.require("%settingsHandlers");
require("../transforms");
require("../helpers");

fluid.registerNamespace("gpii.ul.imports.ableData.transformer");

// Parse the XML data we already have
gpii.ul.imports.ableData.transformer.parseXml = function (that) {
    var parsedXml = gpii.settingsHandlers.XMLHandler.parser.parse(that.model.xml, that.options.xmlParserRules);
    var flattenedJson = gpii.ul.imports.transforms.flatten(parsedXml);
    var remappedJson = fluid.transform(flattenedJson.products, that.transformData);
    that.applier.change("remappedJson", remappedJson);
};

/**
 *
 * Extract the date of the last update from nested data like the following:
 *
 * &lt;span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2012-11-06T19:00:00-05:00"&gt;11/06/2012&lt;/span&gt;
 *
 * @param {String} value - The escaped markup to extract the data from.
 * @return {String} - The date as a string
 *
 */
gpii.ul.imports.ableData.transformer.extractLastUpdated = function (value) {
    var matches = value.match(/.+content *= *"([^"]+)".+/i);
    if (matches) {
        return matches[1];
    }
    else {
        return undefined;
    }
};

fluid.defaults("gpii.ul.imports.ableData.transformer.extractLastUpdated", {
    gradeNames: "fluid.standardTransformFunction"
});

/**
 *
 * Extract the product page link from nested data like the following:
 *
 * &lt;a href="/product/playing-card-holder-model-bk9431"&gt;https://abledata.acl.gov/node/72998&lt;/a&gt;
 *
 * @param {String} value - The escaped markup to extract the data from.
 * @return {String} - The URL as a string
 *
 */
gpii.ul.imports.ableData.transformer.extractProductLink = function (value) {
    var matches = value.match(/.+>([^&]+)<.+/i);
    if (matches) {
        return matches[1];
    }
    else {
        return undefined;
    }
};

fluid.defaults("gpii.ul.imports.ableData.transformer.extractProductLink", {
    gradeNames: "fluid.standardTransformFunction"
});

/**
 *
 * Extract the SID from nested data like the following:
 *
 * &lt;a href="/product/playing-card-holder-model-bk9431"&gt;https://abledata.acl.gov/node/72998&lt;/a&gt;
 *
 * @param {String} value - The escaped markup to extract the data from.
 * @return {String} - The SID as a string
 *
 */
gpii.ul.imports.ableData.transformer.extractProductSid = function (value) {
    var matches = value.match(/.+\/node\/(.+)<.+/i);
    if (matches) {
        return matches[1];
    }
    else {
        return undefined;
    }
};

fluid.defaults("gpii.ul.imports.ableData.transformer.extractProductSid", {
    gradeNames: "fluid.standardTransformFunction"
});

gpii.ul.imports.ableData.transformer.extractTitle = function (value) {
    var matches = value.match(/^<a href=[^>]+>(.+)<[^>]+>$/i);
    if (matches) {
        return matches[1];
    }
    else {
        return value;
    }
};

fluid.defaults("gpii.ul.imports.ableData.transformer.extractTitle", {
    gradeNames: "fluid.standardTransformFunction"
});


/*
    If we decide we need to pull out the structure from category data, we'd need to parse category HTML like:

    <div class='term-tree-list'>
        <ul class="term">
            <li class='selected'>Computers (63601)
                <ul class="term">
                    <li class='selected'>Hardware (63602)
                        <ul class="term">
                            <li class='selected'>Input (63618)
                                <ul class="term">
                                    <li class='selected'>General Input Interfaces (63625)
                                        <ul class="term">
                                            <li class='selected'>Joystick (67343)</li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </li>
            <li class='selected'>Controls (63803)
                <ul class="term">
                    <li class='selected'>Control Switches (63804)
                        <ul class="term">
                            <li class='selected'>Electro-mechanical Switches (63811)
                                <ul class="term">
                                    <li class='selected'>Joysticks (63851)
                                        <ul class="term">
                                            <li class='selected'>Joystick (63852)</li>
                                        </ul>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </li>
            <li class='selected'>Disability Terms (68606)
                <ul class="term">
                    <li class='selected'>Severe Physical Disabilities (67640)</li>
                    <li class='selected'>Upper Extremity Disabilities (67645)</li>
                </ul>
            </li>
            <li class='selected'>Universal (67365)
                <ul class="term">
                    <li class='selected'>Price 1001 To 5000 Dollars (68171)</li>
                </ul>
            </li>
        </ul>
    </div>

    The above would result in text like:

    Computers (63601)
        -> Hardware (63602)
            -> Input (63618)
                -> General Input Interfaces (63625)
                    -> Joystick (67343)

    Controls (63803)
        -> Control Switches (63804)
            -> Electro-mechanical Switches (63811)
                -> Joysticks (63851)
                    -> Joystick (63852)

    Disability Terms (68606)
        -> Severe Physical Disabilities (67640)
        -> Upper Extremity Disabilities (67645)

    Universal (67365)
        -> Price 1001 To 5000 Dollars (68171)

 */
fluid.defaults("gpii.ul.imports.ableData.transformer", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        xml:          {},
        rawJson:      {},
        remappedJson: {}
    },
    xmlParserRules: {
        rules: {
            // Drill down to only the objects we care about to simplify the transform paths
            products: "nodes.node"
        }
    },
    mapRules: {
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
                type: "gpii.ul.imports.ableData.transformer.extractProductSid",
                inputPath: "Link-to-Product-Page"
            }
        },
        name: {
            transform: {
                type: "gpii.ul.imports.ableData.transformer.extractTitle",
                inputPath: "Title"
            }
        },
        description: {
            transform: {
                type: "gpii.ul.imports.transforms.extractDescription",
                inputPath: "Description.$cd"
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
                type: "gpii.ul.imports.ableData.transformer.extractLastUpdated",
                inputPath: "Product-information-last-updated"
            }
        },
        sourceUrl: {
            transform: {
                type: "gpii.ul.imports.ableData.transformer.extractProductLink",
                inputPath: "Link-to-Product-Page"
            }
        },
        // Lightly massage their raw record to include sane titles, parsed category data, etc.
        sourceData: {
            "": "",
            Title: {
                transform: {
                    type: "gpii.ul.imports.ableData.transformer.extractTitle",
                    inputPath: "Title"
                }
            },
            Description: {
                transform: {
                    type: "gpii.ul.imports.transforms.extractDescription",
                    inputPath: "Description.$cd"
                }
            },
            "Product-information-last-updated": {
                transform: {
                    type: "gpii.ul.imports.ableData.transformer.extractLastUpdated",
                    inputPath: "Product-information-last-updated"
                }
            },
            "Link-to-Product-Page": {
                transform: {
                    type: "gpii.ul.imports.ableData.transformer.extractProductLink",
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
    invokers: {
        parseXml: {
            funcName: "gpii.ul.imports.ableData.transformer.parseXml",
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
        }
    }
});
