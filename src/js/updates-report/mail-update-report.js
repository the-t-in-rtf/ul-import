/*

    Generate an email reporting on a single change to a record in the Unified Listing.

*/
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-handlebars");
fluid.require("%gpii-diff");

require("./resolvePath-helper");

var fs            = require("fs");
var juice         = require("juice");
var nodemailer    = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");

fluid.registerNamespace("gpii.ul.imports.mailUpdateReport");

gpii.ul.imports.mailUpdateReport.processQueue = function (that) {
    var diffRecords = require(that.options.file);

    var promises = [];

    var justBigEnough = fluid.find(diffRecords, function (diffRecord) {
        if (diffRecord.description.length > 50) { return diffRecord; }
    });
    promises.push(function () {
        return gpii.ul.imports.mailUpdateReport.mailSingleRecord(that, justBigEnough);
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
gpii.ul.imports.mailUpdateReport.mailSingleRecord = function (that, diffRecord) {
    var promise = fluid.promise();
    var transport = nodemailer.createTransport(smtpTransport(that.options.transportOptions));
    var mailOptions = fluid.copy(that.options.baseMailOptions);

    mailOptions.text = that.renderer.render(that.options.textTemplateKey, { options: that.options, diff: diffRecord});

    var rawHtml = that.renderer.render(that.options.htmlTemplateKey, { options: that.options, diff: diffRecord});
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
    smtpPort:   "8025",
    cssFiles: ["%gpii-diff/src/css/gpii-diff.css", "%ul-imports/src/css/ul-imports.css"],
    // TODO: Make this configurable
    file: "/srv/ul-logs/2017-11-08T18:33:44.191Z-eastin-updatedRecordDiffs-377zhh7i-151.json",
    transportOptions: {
        ignoreTLS: true,
        secure:    false,
        port:      "{that}.options.smtpPort"
    },
    baseMailOptions: {
        from:    "noreply@ul.gpii.net",
        to:      "tony@raisingthefloor.org",
        subject: "Update report for a Unified Listing vendor record." // TODO: Make this dynamic
    },
    components: {
        renderer: {
            type: "gpii.handlebars.standaloneRenderer",
            options: {
                templateDirs: ["%ul-imports/src/templates", "%gpii-diff/src/templates"],
                components: {
                    isDiffArray: {
                        type: "gpii.diff.helper.isDiffArray"
                    },
                    resolvePath: {
                        type: "gpii.ul.imports.helpers.resolvePath"
                    },
                    md: {
                        options: {
                            markdownitOptions: {
                                html: true
                            }
                        }
                    }
                }
            }
        }
    },
    listeners: {
        "onCreate.processQueue": {
            funcName: "gpii.ul.imports.mailUpdateReport.processQueue",
            args:     ["{that}"]
        }
    }
});

// TODO: Write a launcher or provide another means to run this.
gpii.ul.imports.mailUpdateReport();
