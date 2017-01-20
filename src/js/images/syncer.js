"use strict";
var fluid = require("infusion");

var gpii  = fluid.registerNamespace("gpii");

require("./extensions");

// TODO: Convert to using dataSource grades once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
var request = require("request");
var path    = require("path");
var fs      = require("fs");
var mkdirp  = require("mkdirp");

fluid.registerNamespace("gpii.ul.imports.images.syncer.singleRecordSyncer");

gpii.ul.imports.images.syncer.singleRecordSyncer.initAndStartSync = function (that) {
    that.jar = request.jar();
    that.promise = fluid.promise();

    if (that.record.mime_type) {
        gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId(that);
    }
    else {
        // Get the HEAD information for the original image as a precursor to doing anything else.
        request.head({ url: that.record.uri, timeout: 1500 }, function (error, response, body) {
            if (error) {
                fluid.log("Error downloading image file:", error);
                fluid.log("Skipping record...");
                that.promise.resolve();
            }
            else {
                gpii.ul.imports.images.syncer.singleRecordSyncer.handleHeaderResponse(that, response, body);
            }
        });
    }
};

gpii.ul.imports.images.syncer.singleRecordSyncer.handleHeaderResponse = function (that, headerResponse) {
    var contentType = headerResponse.headers["content-type"];
    if (headerResponse.statusCode !== 200) {
        fluid.log("Skipping image file that cannot be downloaded...");
        that.promise.resolve();
    }
    else if (!gpii.ul.imports.images.extensions.extensionByMimeType[contentType]) {
        fluid.log("Skipping image file with invalid mime type '" + contentType + "'...");
        that.promise.resolve();
    }
    else {
        that.record.mime_type = contentType;
        gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId(that);
    }
};

gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId = function (that) {
    // Use the metadata to "evolve" that.record so that it has an "sid" value that includes extension information.
    var extension = gpii.ul.imports.images.extensions.extensionByMimeType[that.record.mime_type];
    if (that.record.image_id.indexOf(extension) === -1) {
        that.record.image_id += "." + extension;
    }

    gpii.ul.imports.images.syncer.singleRecordSyncer.login(that);
};

gpii.ul.imports.images.syncer.singleRecordSyncer.login = function (that) {
    var loginOptions = {
        url: that.options.urls.login,
        body: {
            username: that.options.username,
            password: that.options.password
        },
        json:true,
        jar: that.jar
    };
    request.post(loginOptions, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject(body);
        }
        else {
            gpii.ul.imports.images.syncer.singleRecordSyncer.readApiRecord(that);
        }
    });
}
;

gpii.ul.imports.images.syncer.singleRecordSyncer.readApiRecord = function (that) {
    // TODO: Update this to use the image API
    var key = encodeURIComponent(JSON.stringify([that.record.uid, that.record.source, that.record.image_id]));
    var apiReadUrl = fluid.stringTemplate("%base/_design/metadata/_view/combined?key=%key", {
        base: that.options.urls.imageDb,
        key: key
    });

    // Check to see if the record already exists
    var options = {
        url: apiReadUrl,
        jar: that.jar,
        json: true
    };

    // Check the image API to see if we already have image metadata for this "uid", "source", and "sid".
    request.get(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode === 404 || body.rows.length === 0) {
            fluid.log("No image metadata found for record '" +  that.record.image_id + "', creating it now...");
            gpii.ul.imports.images.syncer.singleRecordSyncer.createRecord(that);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({isError: true, message: "Error downloading image metadata", body: body});
        }
        else {
            fluid.log("image metadata already exists for record '" +  that.record.image_id + "', checking to see if image content has been downloaded...");
            gpii.ul.imports.images.syncer.singleRecordSyncer.handleMetadataWriteResponse(that);
        }
    });
};

// TODO: For new images, download the file to a temporary directory and then upload it to the image API.
gpii.ul.imports.images.syncer.singleRecordSyncer.createRecord = function (that) {
    // Write the metadata record to the database directly.
    // TODO: Convert this to use the image API once the "write" portions are available.
    var options = {
        url:  that.options.urls.imageDb,
        json: true,
        jar:  that.jar,
        body: fluid.censorKeys(that.record, ["mime_type"])
    };

    request.post(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 201) {
            that.promise.reject({isError: true, statusCode: response.statusCode, message: body });
        }
        else {
            fluid.log("Image metadata saved for record '" +  that.record.image_id + "'...");
            gpii.ul.imports.images.syncer.singleRecordSyncer.handleMetadataWriteResponse(that);
        }
    });
};

gpii.ul.imports.images.syncer.singleRecordSyncer.handleMetadataWriteResponse = function (that) {
    // TODO: Convert this to use the image API once the "write" portions are available.
    // The path should be: :base/:source/:uid/:image_id
    var baseDir = fluid.module.resolvePath(that.options.imageDir);
    var dirPath = path.resolve(baseDir, that.record.uid, that.record.source); // TODO: Change this to "sid" once we use the image API for writes.
    var filePath = path.resolve(dirPath, that.record.image_id);

    if (fs.existsSync(filePath)) {
        fluid.log("Image file already exists for record '" +  that.record.image_id + "', skipping download...");
        that.promise.resolve();
    }
    else {
        // Create the full path if it does not already exist.
        mkdirp(dirPath, function (error) {
            if (error) {
                that.promise.reject(error);
            }
            else {
                // Adapted from: http://stackoverflow.com/questions/12740659/downloading-images-with-node-js
                request(that.record.uri).pipe(fs.createWriteStream(filePath)).on("close", function (error) {
                    if (error) {
                        that.promise.reject(error);
                    }
                    else {
                        fluid.log("Saved image file for record '" +  that.record.image_id + "' to disk...");
                        that.promise.resolve();
                    }
                });
            }
        });
    }
};


fluid.defaults("gpii.ul.imports.images.syncer.singleRecordSyncer", {
    gradeNames: ["fluid.component"],
    messages: {
        notFound: "Image not found."
    },
    listeners: {
        "onCreate.initAndStartSync": {
            funcName: "gpii.ul.imports.images.syncer.singleRecordSyncer.initAndStartSync",
            args: ["{that}"]
        }
    }
});

gpii.ul.imports.images.syncer.startSync = function (that) {
    var promises = [];
    fluid.log("Starting sync of " + that.model.recordsToSync.length + " records...");
    fluid.each(that.model.recordsToSync, function (record) {
        // Only records with a uid and URI can be synced.
        if (!record.uid) {
            fluid.log("skipping record '" +  record.image_id + "' that lacks a UID...");
        }
        else if (!record.uri) {
            fluid.log("skipping record '" +  record.image_id + "' that lacks an image URI...");
        }
        else {
            promises.push(function () {
                // TODO: Convert to using dynamic components once we confirm that we can do so without the next one clobbering the previous.
                var syncer = gpii.ul.imports.images.syncer.singleRecordSyncer(
                    {
                        imageDir: that.options.imageDir,
                        urls: that.options.urls,
                        username: that.options.username,
                        password: that.options.password,
                        source: that.options.source,
                        members: { record: record } }
                    );
                return syncer.promise;
            });
        }
    });

    var sequence = fluid.promise.sequence(promises);

    sequence.then(that.handleSuccess, that.handleError);
};

gpii.ul.imports.images.syncer.handleSuccess = function (that, results) {
    fluid.log(fluid.stringTemplate(that.options.messages.savedRecords, { length: results.length }));
};

fluid.defaults("gpii.ul.imports.images.syncer", {
    gradeNames: ["fluid.modelComponent"],
    messages: {
        errorSavingRecords: "There was an error syncing one or more records.",
        savedRecords: "Successfully processed %length records."
    },
    model: {
        recordsToSync: []
    },
    modelListeners: {
        recordsToSync: {
            funcName:      "gpii.ul.imports.images.syncer.startSync",
            args:          ["{that}"],
            excludeSource: "init"
        }
    },
    invokers: {
        handleSuccess: {
            funcName: "gpii.ul.imports.images.syncer.handleSuccess",
            args:     ["{that}", "{arguments}.0"]
        }
    }
});
