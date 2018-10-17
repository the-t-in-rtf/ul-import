// A component to transform AbleData's data into the format required by the Unified Listing.
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%universal");
fluid.require("%settingsHandlers");
// require("../../../../node_modules/universal/gpii/node_modules/settingsHandlers/index");
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
 * @attr {String} value - The escaped markup to extract the data from.
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
 * @attr {String} value - The escaped markup to extract the data from.
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
 * @attr {String} value - The escaped markup to extract the data from.
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
            products: "search_api_index_product_export_indexs.search_api_index_product_export_index"
        }
    },
    mapRules: {
        /*
         */
        source: {
            literalValue: "{that}.options.defaults.source"
        },
        sid: {
            transform: {
                type: "gpii.ul.imports.ableData.transformer.extractProductSid",
                inputPath: "Link-to-Product-Page"
            }
        },
        name: "Title",
        description: "Description",
        manufacturer: {
            name:    "Maker"
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
        sourceData: ""
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
