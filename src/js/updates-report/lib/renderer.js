/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

fluid.require("%gpii-handlebars");
fluid.require("%gpii-diff");

require("./sanitize-filename-helper");
require("./resolvePath-helper");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.renderer", {
    gradeNames: ["gpii.handlebars.standaloneRenderer"],
    templateDirs: ["%ul-imports/src/templates", "%gpii-diff/src/templates"],
    components: {
        hasChanged: {
            type: "gpii.diff.helper.hasChanged"
        },
        isDiffArray: {
            type: "gpii.diff.helper.isDiffArray"
        },
        leftValue: {
            type: "gpii.diff.helper.leftValue"
        },
        md: {
            options: {
                markdownItOptions: {
                    html: true
                }
            }
        },
        resolvePath: {
            type: "gpii.ul.imports.helpers.resolvePath"
        },
        rightValue: {
            type: "gpii.diff.helper.rightValue"
        },
        sanitizeFilename: {
            type: "gpii.ul.imports.helpers.sanitizeFilename"
        }
    }
});
