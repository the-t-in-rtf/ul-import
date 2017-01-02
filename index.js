// The main file that is included when you run `require("ul-import")`.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.import");

fluid.module.register("gpii-ul-import", __dirname, require);

module.exports = gpii.ul["import"];

