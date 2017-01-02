/*

A launcher for the EASTIN synchronization process.  Instantiates the relevant runner and launches it.

 */

// TODO:  Add the ability to cleanly override options using command-line arguments or environment variables.
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");
fluid.setLogging(true);

require("./runner");

var loader           = require("../../../../config/lib/config-loader");
var config           = loader.loadConfig({});

// TODO:  Collapse the config file structure once we separate out the repository.
gpii.ul.imports.eastin.runner(config.eastin);
