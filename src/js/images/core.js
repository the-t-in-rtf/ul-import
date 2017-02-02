/*

    The "core" image syncer.  Used in the EASTIN and SAI importers in this directory.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");

fluid.registerNamespace("gpii.ul.imports.images.core");

require("./syncer.js");
fluid.require("%gpii-launcher");

require("./transformer");

gpii.ul.imports.images.core.login = function (that) {
    that.jar = request.jar();

    // TODO:  Convert to using a dataSource once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    // Login
    var loginOptions = {
        url: that.options.urls.login,
        json: true,
        jar: that.jar,
        body: {
            username: that.options.username,
            password: that.options.password
        }
    };

    request.post(loginOptions, function (error, response, body) {
        if (error) {
            that.handleError(error);
        }
        else if (response.statusCode !== 200) {
            that.handleError(body);
        }
        else {
            gpii.ul.imports.images.core.startDownload(that);
        }
    });
};

gpii.ul.imports.images.core.startDownload = function (that) {
    var sources = encodeURIComponent(JSON.stringify(fluid.makeArray(that.options.sources)));
    var sourceRecordUrl = fluid.stringTemplate(
        "%baseUrl/products?sources=%sources&unified=false&limit=10000",
        {
            baseUrl: that.options.urls.api,
            sources: sources
        }
    );

    // Retrieve the source record.
    request.get({ url: sourceRecordUrl, json:true, jar: that.jar }, function (error, response, body) {
        if (error) {
            that.handleError(error);
        }
        else if (response.statusCode !== 200) {
            that.handleError(body);
        }
        else {
            gpii.ul.imports.images.core.saveImageRecords(that, body);
        }
    });
};

gpii.ul.imports.images.core.saveImageRecords = function (that, imageRecordData) {
    var records = fluid.model.transformWithRules(imageRecordData, that.options.rules.extractImageRecords);
    that.transformer.applier.change("rawJson", records);
};

fluid.defaults("gpii.ul.imports.images.core", {
    imagesToExclude: false,
    gradeNames: ["fluid.component"],
    rules: {
        extractImageRecords: {
            "": "products"
        }
    },
    setLogging: false,
    messages: {
        errorLoadingImageData: "There was an error loading the source image data:"
    },
    components: {
        transformer: {
            type: "gpii.ul.imports.images.transformer",
            options: {
                imagesToExclude: "{core}.options.imagesToExclude"
            }
        },
        syncer: {
            type: "gpii.ul.imports.images.syncer",
            options: {
                source:   "{gpii.ul.imports.images.core}.options.source",
                username: "{gpii.ul.imports.images.core}.options.username",
                password: "{gpii.ul.imports.images.core}.options.password",
                urls:     "{gpii.ul.imports.images.core}.options.urls",
                imageDir: "{gpii.ul.imports.images.core}.options.imageDir",
                model: {
                    recordsToSync: "{transformer}.model.transformedJson"
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
        "onCreate.login": {
            funcName: "gpii.ul.imports.images.core.login",
            args:     ["{that}"]
        }
    },
    invokers: {
        handleError: {
            funcName: "fluid.fail",
            args: ["{that}.options.messages.errorLoadingImageData", "{arguments}.0"]
        }
    }
});

fluid.defaults("gpii.ul.imports.images.core.launcher", {
    gradeNames: ["gpii.launcher"],
    mergePolicy: {
        "yargsOptions.demand": "nomerge"
    },
    yargsOptions: {
        describe: {
            "urls.sourceImages": "The URL we will use to retrieve the original source records containing image metadata.",
            "urls.imageApi": "The base URL for the UL Image API.",
            "imageDir": "The base directory in which we should store download images", // TODO: Remove this once we use the image API directly.
            "setLogging": "The fluid.log log level.  Set to `true` to display messages at the INFO level or higher.",
            "sources": "The sources we are importing images from.  Should be stringified JSON representing a string (i.e. with quotes) or array of strings.",
            "username": "The username to use when saving records to the image API.",
            "password": "The password to use when saving records to the image API."
            // TODO: implement and enable this option once we start using the image API for writes.
            // "tmpDir": "The temporary directory to store images in before uploading them to the image API."
        },
        coerce: {
            setLogging: JSON.parse,
            sources:     JSON.parse
        },
        defaults: {
            "optionsFile": "{that}.options.optionsFile"
        },
        help: true
    },
    optionsFile: "%ul-imports/configs/image-sync-base.json"
});
