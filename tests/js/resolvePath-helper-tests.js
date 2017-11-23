/*

    Tests for the {{resolvePath}} helper used in this package.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%ul-imports/src/js/updates-report/resolvePath-helper.js");

var jqUnit = require("node-jqunit");

fluid.registerNamespace("gpii.tests.ul.imports.helpers.resolvePath");

gpii.tests.ul.imports.helpers.resolvePath.runAllTests = function (that) {
    fluid.each(that.options.testDefs, function (testDef) {
        gpii.tests.ul.imports.helpers.resolvePath.runSingleTest(that, testDef);
    });
};

gpii.tests.ul.imports.helpers.resolvePath.runSingleTest = function (that, testDef) {
    jqUnit.test(testDef.message, function () {
        var output = that.render(that.options.templateKey, testDef);
        var resolvedPath = fluid.module.resolvePath(testDef.path);
        jqUnit.assertEquals("The output should be as expected.", resolvedPath, output);
    });
};

fluid.defaults("gpii.tests.ul.imports.helpers.resolvePath", {
    gradeNames: ["gpii.handlebars.standaloneRenderer"],
    templateKey: "resolvePath",
    templateDirs: ["%ul-imports/tests/templates"],
    mergePolicy: {
        "testDefs": "nomerge, noexpand"
    },
    testDefs: {
        validPath: {
            message: "A valid path should resolve correctly.",
            path:    "%ul-imports/README.md"
        },
        missingPackage: {
            message: "A missing package should resolve correctly.",
            path:    "%gpii-fix-all-the-things"
        }
    },
    components: {
        resolvePath: {
            type: "gpii.ul.imports.helpers.resolvePath"
        }
    },
    listeners: {
        "onCreate.announceModule": {
            priority: "first",
            funcName: "jqUnit.module",
            args:     ["Tests for the {{resolvePath}} handlebars helper."]
        },
        "onCreate.runAllTests": {
            funcName: "gpii.tests.ul.imports.helpers.resolvePath.runAllTests",
            args:     ["{that}"]
        }
    }
});

gpii.tests.ul.imports.helpers.resolvePath();
