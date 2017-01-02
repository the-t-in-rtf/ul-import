// This script is designed to (optionally) download data from GARI and get it ready to importer into the Unified Listing.
//
// For full details, see the README.md file in this directory
//
// To see the list of default options, look at `./src/js/importer`

"use strict";
var fluid = require("infusion");
fluid.setLogging(true);
var gpii  = fluid.registerNamespace("gpii");

require("./runner");
gpii.ul.imports.gari.runner();
