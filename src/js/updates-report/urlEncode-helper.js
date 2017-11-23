/*

    A handlebars helper to url encode strings. Only works in Node.js.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-handlebars");

fluid.registerNamespace("gpii.ul.imports.helpers.urlEncode.getUrlEncodeFunction");

gpii.ul.imports.helpers.urlEncode.getUrlEncodeFunction = function () {
    return function (stringToEncode) {
        return encodeURIComponent(stringToEncode);
    };
};

fluid.defaults("gpii.ul.imports.helpers.urlEncode", {
    gradeNames: ["gpii.handlebars.helper"],
    helperName: "urlEncode",
    invokers: {
        "getHelper": {
            "funcName": "gpii.ul.imports.helpers.urlEncode.getUrlEncodeFunction",
            "args":     []
        }
    }
});
