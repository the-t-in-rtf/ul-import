/*

    A script that allows you to create "unified" records based on incoming "source" records.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%kettle");
fluid.require("%ul-imports");

require("../launcher");
require("../dataSource");
require("../concurrent-promise-queue");

/*

    A grade that handles a single "adoption", in which we:

    1. Read an "orphaned" record.
    2. Use that record to create a new "unified" record.
    3. Update the "orphaned" record to indicate that the new "unified" record is its parent.

 */
fluid.registerNamespace("gpii.ul.imports.unifier.singleAdoptionHandler");

// TODO: Consider converting to an invoker once https://issues.fluidproject.org/browse/KETTLE-54 is resolved.
gpii.ul.imports.unifier.singleAdoptionHandler.login = function (that) {
    that.promise = fluid.promise();
    that.jar = request.jar();

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        url: that.options.urls.login,
        jar: that.jar,
        json: true,
        body: {
            username: that.options.username,
            password: that.options.password
        }
    };
    request.post(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Logged in...");
            that.handleLoginResponse();
        }
    });
};


gpii.ul.imports.unifier.singleAdoptionHandler.readChild = function (that) {
    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var childReaderUrl = fluid.stringTemplate("%baseUrl/%source/%sid", { baseUrl: that.options.urls.product, source: that.options.source, sid: encodeURIComponent(that.options.sid) });
    var options = {
        url:  childReaderUrl,
        jar:  that.jar,
        json: true
    };
    request.get(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Read existing child record...");
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
        url:  that.options.urls.product,
        jar:  that.jar,
        json: true,
        body: unifiedRecord
    };
    request.post(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200 && response.statusCode !== 201) {
            that.promise.reject({ isError: true, message: body });
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Retrieved child record...");
            that.handleParentWriteResponse(body.product);
        }
    });
};

gpii.ul.imports.unifier.singleAdoptionHandler.handleParentWriteResponse = function (that, parentRecord) {
    that.childRecord.uid = parentRecord.uid;

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        url:  that.options.urls.product,
        jar:  that.jar,
        json: true,
        body: that.childRecord
    };
    request.post(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({ isError: true, message: body, parentRecord: parentRecord });
            // The parent record is included so that we can manually clean up when a parent is created but the "adoption" is never completed.
        }
        else {
            var product = body.product;
            fluid.log(fluid.logLevel.TRACE, "Succesfully created unified record '", product.uid, "' based on child record ", product.source, ":", product.sid);
            fluid.log(fluid.logLevel.TRACE, "Created parent record...");
            that.promise.resolve(body);
        }
    });
};

fluid.defaults("gpii.ul.imports.unifier.singleAdoptionHandler", {
    gradeNames: ["fluid.component"],
    members: {
        childRecord: {}
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

gpii.ul.imports.unifier.generateAdoptionFunction = function (that, record) {
    return function () {
        var adoptionHandler = gpii.ul.imports.unifier.singleAdoptionHandler({
            source: record.value.source,
            sid: record.value.sid,
            username: that.options.username,
            password: that.options.password,
            urls: that.options.urls,
            members: {
                cookieJar: that.cookieJar
            }
        });
        return adoptionHandler.promise;
    };
};

gpii.ul.imports.unifier.handleOrphanResponse = function (that, response) {
    var promises = [];
    fluid.each(response.rows, function (record) {
        if (record.value.source && record.value.sid) {
            // We use a promise-returning function in our sequence to avoid immediately starting all requests.
            promises.push(gpii.ul.imports.unifier.generateAdoptionFunction(that, record));
        }
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

    queue.then(function (results) {
        fluid.log(fluid.logLevel.IMPORTANT, "Created unified records for " + results.length + " orphaned records...");
    }, that.handleError);
};

gpii.ul.imports.unifier.handleError = function (that, errorResponse) {
    if (errorResponse.parentRecord) {
        fluid.fail(
            "There was an error associating a 'child' record with a newly created parent.  The following record should be manually deleted:\n",
            JSON.stringify(errorResponse.parentRecord, null, 2),
            "\nThe original error message is:\n",
            errorResponse.message
        );
    }
    else {
        fluid.fail("Error cloning orphaned record:", JSON.stringify(errorResponse, null, 2));
    }

};


fluid.defaults("gpii.ul.imports.unifier", {
    gradeNames: ["fluid.component"],
    maxRequests: 2,
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
    optionsFile: "%ul-imports/configs/unifier-prod.json",
    "yargsOptions": {
        "describe": {
            "username":  "The username to use when writing changes to the UL.",
            "password":  "The password to use when writing changes to the UL.",
            "orphanUrl": "The CouchDB view to use when retrieving the list of records that are no associated with a unified record."
        }
    }
});

gpii.ul.imports.unifier.launcher();
