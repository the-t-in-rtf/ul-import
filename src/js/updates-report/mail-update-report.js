/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff" file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-handlebars");
fluid.require("%gpii-diff");
fluid.require("%gpii-launcher");

require("./jsonLoader");
require("./renderer");

var fs            = require("fs");
var juice         = require("juice");
var nodemailer    = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");

fluid.registerNamespace("gpii.ul.imports.mailUpdateReport");

gpii.ul.imports.mailUpdateReport.processQueue = function (that) {
    var diffsAndUpdates = gpii.ul.imports.resolveAndLoadJsonFromPath(that.options.diffsAndUpdatesPath);

    var promises = [];

    fluid.each(diffsAndUpdates, function (diffAndUpdate) {
        promises.push(function () {
            return gpii.ul.imports.mailUpdateReport.mailSingleRecord(that, diffAndUpdate);
        });
    });

    var sequence = fluid.promise.sequence(promises);
    sequence.then(
        function (results) { fluid.log("Sent ", results.length, " update emails...");},
        fluid.fail
    );
};

// Send a message using `nodemailer-smtp-transport`.  Here is a basic example of typical `mailOptions`:
//
// {
//   from:    "sender@site1.com",
//   to:      "recipient@site2.com",
//   cc:      "overseer@site3.com",
//   subject: "Sample subject...",
//   text:    "Text body of the message.\n",
//   html:    "<p>HTML body of the message.</p>\n"
// }
//
// Note that the `to` and `cc` elements can also be passed an array of email addresses.  The full syntax available for
// `mailOptions` can be found in [the nodemailer documentation](https://github.com/andris9/Nodemailer).
//
gpii.ul.imports.mailUpdateReport.mailSingleRecord = function (that, diffAndUpdate) {
    var promise = fluid.promise();
    var transport = nodemailer.createTransport(smtpTransport(that.options.transportOptions));
    var mailOptions = fluid.copy(that.options.baseMailOptions);

    mailOptions.text = that.renderer.render(that.options.textTemplateKey, { options: that.options, diff: diffAndUpdate.diff, update: diffAndUpdate.update});
    mailOptions.subject = fluid.stringTemplate(that.options.subjectTemplate, diffAndUpdate.update);

    var rawHtml = that.renderer.render(that.options.htmlTemplateKey, { options: that.options, diff: diffAndUpdate.diff, update: diffAndUpdate.update});
    var allCssContent = "";
    fluid.each(fluid.makeArray(that.options.cssFiles), function (cssFile) {
        var resolvedCssPath = fluid.module.resolvePath(cssFile);
        var cssContent = fs.readFileSync(resolvedCssPath);
        allCssContent += cssContent;
    });
    var inlinedHtml = juice.inlineContent(rawHtml, allCssContent);
    mailOptions.html = inlinedHtml;

    transport.sendMail(mailOptions, function (err, info) {
        if (err) {
            // TODO: Consider saving failures to a retry file of some kind...
            promise.reject(err);
        }
        else {
            promise.resolve(info);
        }
    });
    return promise;
};

fluid.defaults("gpii.ul.imports.mailUpdateReport", {
    gradeNames: ["fluid.component"],
    textTemplateKey: "single-update-email-text",
    htmlTemplateKey: "single-update-email-html",
    smtpPort:   25,
    cssFiles: ["%gpii-diff/src/css/gpii-diff.css", "%ul-imports/src/css/ul-imports.css"],
    transportOptions: {
        ignoreTLS: true,
        secure:    false,
        port:      "{that}.options.smtpPort"
    },
    subjectTemplate: "Update report for Unified Listing vendor record '%source:%sid'.",
    baseMailOptions: {
        from:    "noreply@ul.gpii.net",
        to:      "ul-fed-db-update@raisingthefloor.org"
    },
    components: {
        renderer: {
            type: "gpii.ul.imports.renderer"
        }
    },
    listeners: {
        "onCreate.processQueue": {
            funcName: "gpii.ul.imports.mailUpdateReport.processQueue",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.mailUpdateReport.launcher", {
    gradeNames: ["gpii.launcher"],
    optionsFile: "%ul-imports/configs/updates-email.json",
    "yargsOptions": {
        "describe": {
            "diffsAndUpdatesPath": "The path (absolute or package-relative) to the 'diffs and updates' JSON file generated for a given import.",
            "outputDir":           "The path (absolute or package-relative) to the directory where the output from this run will be saved.",
            "setLogging":          "Whether to display verbose log messages.  Set to `true` by default.",
            "smtpPort":            "The mail server port to use when sending outgoing messages."
        },
        required: ["diffsAndUpdatesPath", "outputDir"],
        defaults: {
            "optionsFile": "{that}.options.optionsFile",
            "outputDir":   "{that}.options.outputDir",
            "setLogging":  true
        },
        coerce: {
            "setLogging": JSON.parse
        },
        help: true
    }
});

gpii.ul.imports.mailUpdateReport.launcher();
