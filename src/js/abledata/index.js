/*

    This script is designed to download data from AbleData and get it ready to import into the Unified Listing.  their
    records are XML, and look something like:

    <search_api_index_product_export_index>
        <Title>Playing Card Holder (Model Bk9431)</Title>
        <Description>
            The Playing Card Holder, model 9431, is a playing card holder designed for use by individuals with fine motor
            and grasping disabilities.  Features include extruded 2-inch wide base that is 1 3/8 inches in height, and a
            1/2-inch slot that narrows to 1/8 inch for easy entry of cards. DIMENSIONS: The holder is 10-inches long.
        </Description>
        <Product-Status>Available</Product-Status>
        <Category>
            Cards, Recreation, Recreation, Games and Puzzles, Cards, Playing Card Holder, Recreation, Games and Puzzles,
            Universal, Games, Price &lt; 10 Dollars
        </Category>
        <Maker>Performance Health (Formerly Patterson Medical)</Maker>
        <Seller-s->Wisdomking.com, Inc.</Seller-s->
        <Product-information-last-updated>&lt;span class="date-display-single" property="dc:date" datatype="xsd:dateTime" content="2012-11-06T19:00:00-05:00"&gt;11/06/2012&lt;/span&gt;</Product-information-last-updated>
        <Link-to-Product-Page>&lt;a href="/product/playing-card-holder-model-bk9431"&gt;https://abledata.acl.gov/node/72998&lt;/a&gt;</Link-to-Product-Page>
    </search_api_index_product_export_index>

    Our "source data" is stored in JSON, so we convert the XML to JSON before further transforming it.

*/
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii  = fluid.registerNamespace("gpii");

require("../importer");
require("../launcher");
require("../downloader");
require("../syncer");
require("./transforms");

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
    invokers: {
        parseXml: {
            funcName: "gpii.ul.imports.ableData.transforms.parseXml",
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

fluid.defaults("gpii.ul.imports.ableData", {
    gradeNames: ["gpii.ul.imports.importer"],
    cacheFilename: "ableData.xml",
    model: {
        rawData:       "{transformer}.model.xml",
        processedData: "{transformer}.model.remappedJson"
    },
    components: {
        downloader: {
            options: {
                url: "{gpii.ul.imports.ableData}.options.urls.ableData",
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.none" // We are dealing with XML data.
                    }
                }
            }
        },
        transformer: {
            type: "gpii.ul.imports.ableData.transformer"
        }
    }
});

fluid.defaults("gpii.ul.imports.ableData.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/ableData-prod.json",
    "yargsOptions": {
        "describe": {
            "username": "The username to use when writing records to the UL.",
            "password": "The password to use when writing records to the UL.",
            "source": "The UL source to sync records with.",
            "setLogging": "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            // TODO: Eventually we will also need to bring in the structured category data as well. Look at EASTIN.
            "urls.ableData": "The URL to use when retrieving records from AbleData."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.ableData.launcher();

