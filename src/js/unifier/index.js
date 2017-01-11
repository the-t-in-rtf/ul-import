/*

    A script that allows you to create "unified" records based on incoming "source" records.

 */
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var request = require("request");

fluid.setLogging(true);
fluid.require("%kettle");

require("../launcher");
require("../dataSource");

/*

    A grade that handles a single "adoption", in which we:

    1. Read an "orphaned" record.
    2. Use that record to create a new "unified" record.
    3. Update the "orphaned" record to indicate that the new "unified" record is its parent.

 */
fluid.registerNamespace("gpii.ul.imports.unifier.singleAdoptionHandler");

// TODO: Consider converting to an invoker once https://issues.fluidproject.org/browse/KETTLE-54 is resolved.
gpii.ul.imports.unifier.singleAdoptionHandler.login = function (that) {
    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        jar: true,
        json: true,
        body: {
            username: that.options.username,
            password: that.options.password
        }
    };
    request.post(that.options.urls.login, options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            fluid.log("Logged in...");
            that.handleLoginResponse();
        }
    });
};


gpii.ul.imports.unifier.singleAdoptionHandler.readChild = function (that) {
    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var childReaderUrl = fluid.stringTemplate("%baseUrl/%source/%sid", { baseUrl: that.options.urls.product, source: that.options.source, sid: that.options.sid });
    var options = {
        jar: true,
        json: true
    };
    request.get(childReaderUrl, options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            fluid.log("Read existing child record...");
            that.handleChildReadResponse(body);
        }
    });
};

gpii.ul.imports.unifier.singleAdoptionHandler.handleChildReadResponse = function (that, childRecord) {
    that.childRecord = childRecord;

    var unifiedRecord = fluid.censorKeys(childRecord, ["source", "sid", "sourceData", "updated"]);
    unifiedRecord.source = "unified";

    // TODO:  We need to figure out a better way of setting initial uids and managing them over time.
    var tempUid = Date.now() + "-" + Math.round(Math.random() * 1000000000);

    unifiedRecord.sid = tempUid;
    unifiedRecord.uid = tempUid;

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        jar:  true,
        json: true,
        body: unifiedRecord
    };
    request.post(that.options.urls.product, options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200 && response.statusCode !== 201) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            fluid.log("Retrieved child record...");
            that.handleParentWriteResponse(body.product);
        }
    });
};

gpii.ul.imports.unifier.singleAdoptionHandler.handleParentWriteResponse = function (that, parentRecord) {
    that.childRecord.uid = parentRecord.uid;

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        jar: true,
        json: true,
        body: that.childRecord
    };
    request.post(that.options.urls.product, options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            var product = body.product;
            fluid.log("Succesfully created unified record '", product.uid, "' based on child record ", product.source, ":", product.sid);
            fluid.log("Created parent record...");
            that.promise.resolve(body);
        }
    });
};

fluid.defaults("gpii.ul.imports.unifier.singleAdoptionHandler", {
    gradeNames: ["fluid.component"],
    members: {
        childRecord: {},
        promise: fluid.promise()
    },
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.login",
            args:     ["{that}"]
        }
    },
    invokers: {
        "handleLoginResponse": {
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.readChild",
            args:     ["{that}", "{arguments}.0"]
        },
        "handleChildReadResponse": {
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.handleChildReadResponse",
            args:     ["{that}", "{arguments}.0"]
        },
        "handleParentWriteResponse": {
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.handleParentWriteResponse",
            args:     ["{that}", "{arguments}.0"]
        },
        "handleError": {
            funcName: "gpii.ul.imports.unifier.handleError",
            args:     ["{that}", "{arguments}.0"]
        }
    }
});

fluid.registerNamespace("gpii.ul.imports.unifier");

// TODO: Consider converting to an invoker once https://issues.fluidproject.org/browse/KETTLE-54 is resolved.
gpii.ul.imports.unifier.findOrphanedRecords = function (that) {
    var promise = that.orphanReader.get({ sid: that.options.sid, source: that.options.source });
    promise.then(that.handleOrphanResponse, that.handleError);
};

gpii.ul.imports.unifier.handleOrphanResponse = function (that, response) {
    var promises = [];
    // TODO: Remove this once we have tested the process
    fluid.each(response.rows.slice(0,1), function (record) {
    // fluid.each(response.rows, function (record) {
        if (record.value.source && record.value.sid) {
            var adoptionHandler = gpii.ul.imports.unifier.singleAdoptionHandler({
                source: record.value.source,
                sid: record.value.sid,
                urls: that.options.urls,
                members: {
                    cookieJar: that.cookieJar
                }
            });
            promises.push(adoptionHandler.promise);
        }
    });

    var sequence = fluid.promise.sequence(promises);

    sequence.then(function (results) {
        fluid.log("Created unified records for " + results.length + " orphaned records...");
    }, that.handleError);
};

gpii.ul.imports.unifier.handleError = function (that, errorResponse) {
    fluid.fail("Error cloning orphaned record:", JSON.stringify(errorResponse, null, 2));
};


fluid.defaults("gpii.ul.imports.unifier", {
    gradeNames: ["fluid.component"],
    components: {
        orphanReader: {
            type: "gpii.ul.imports.dataSource",
            options: {
                url: "{gpii.ul.imports.unifier}.options.orphanUrl"
            }
        }
    },
    invokers: {
        "handleOrphanResponse": {
            funcName: "gpii.ul.imports.unifier.handleOrphanResponse",
            args:     ["{that}", "{arguments}.0"]
        },
        "handleError": {
            funcName: "gpii.ul.imports.unifier.handleError",
            args:     ["{that}", "{arguments}.0"]
        }
    },
    listeners: {
        "onCreate.findOrphanedRecords": {
            funcName: "gpii.ul.imports.unifier.findOrphanedRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.unifier.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-import/configs/unifier-dev.json",
    "yargsOptions": {
        "describe": {
            "username":  "The username to use when writing changes to the UL.",
            "password":  "The password to use when writing changes to the UL.",
            "orphanUrl": "The CouchDB view to use when retrieving the list of records that are no associated with a unified record."
        }
    }
});

gpii.ul.imports.unifier.launcher();
