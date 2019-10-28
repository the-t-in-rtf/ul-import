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
var gpii  = fluid.registerNamespace("gpii");

require("../importer");
require("../launcher");
require("../downloader");
require("../syncer");
require("./downloader");
require("./transformer");
require("./transforms");

fluid.defaults("gpii.ul.imports.ableData", {
    gradeNames: ["gpii.ul.imports.importer"],
    cacheFilename: "ableData.json",
    model: {
        rawData:       "{transformer}.model.xml",
        processedData: "{transformer}.model.remappedJson"
    },
    components: {
        downloader: {
            type: "gpii.ul.imports.ableData.downloader",
            options: {
                urlTemplates: "{gpii.ul.imports.ableData}.options.urlTemplates.ableData",
                model: {
                    records: "{gpii.ul.imports.importer}.model.rawData"
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
            "urls.ableData": "The URL to use when retrieving records from AbleData."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.ableData.launcher();
