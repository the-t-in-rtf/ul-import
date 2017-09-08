"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%ul-imports");

require("../importer");
require("../launcher");
require("./transforms");

/*

    We need to transform a raw SAI record, which should look something like:

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

    The rules below transform this into our JSON format.

 */
fluid.defaults("gpii.ul.imports.sai", {
    gradeNames: ["gpii.ul.imports.importer"],
    cacheFilename: "sai.json",
    components: {
        downloader: {
            options: {
                url: "{gpii.ul.imports.sai}.options.urls.sai.records"
            }
        },
        transformer: {
            options: {
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
                    "status": "ul_status",
                    "source": { literalValue: "sai" },
                    "sid": "nid",
                    "manufacturer": {
                        transform: {
                            type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                            values: [ "manufacturer", { literalValue: { name: "Unknown" } } ]
                        }
                    },
                    "sourceData": ""
                }
            }
        }
    }
});

fluid.defaults("gpii.ul.imports.sai.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/sai-prod.json",
    "yargsOptions": {
        "describe": {
            "username":   "The username to use when writing records to the UL.",
            "password":   "The password to use when writing records to the UL.",
            "source":     "The UL source to sync records with.",
            "setLogging": "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            "urls.sai":   "The URL to use when retrieving records from the SAI."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.sai.launcher();
