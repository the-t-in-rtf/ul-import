"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

require("../downloader");

fluid.registerNamespace("gpii.ul.imports.sai.downloader");

gpii.ul.imports.sai.downloader.saveData = function (that, error, response, body) {
    var filtered = body.filter(function (entry) {
        return entry.status !== "NEW";
    });
    gpii.ul.imports.downloader.saveData(that, error, response, filtered);
};

fluid.defaults("gpii.ul.imports.sai.downloader", {
    gradeNames: ["gpii.ul.imports.downloader"],
    invokers: {
        saveData: {
            funcName: "gpii.ul.imports.sai.downloader.saveData",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
        }
    }
});
