"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%ul-imports");
fluid.require("%gpii-handlebars");

require("../bundle-deps");

fluid.popLogging();

var bundlePromise = gpii.ul.imports.copyDependencies("/tmp/abledata-sandbox", {
    "":  ["%ul-imports/src/html/abledata-sandbox/index.html"],
    css: ["%ul-imports/node_modules/foundation-sites/dist/css/foundation.css"],
    js:  [
        "/tmp/abledata-data.js",
        "%infusion/dist/infusion-all.js",
        "%infusion/dist/infusion-all.js.map",
        "%ul-imports/node_modules/fuse.js/dist/fuse.js",
        "%ul-imports/node_modules/markdown-it/dist/markdown-it.js",
        "%ul-imports/node_modules/handlebars/dist/handlebars.js",
        "%ul-imports/src/js/abledata/client/static-search.js",
        "%gpii-handlebars/src/js/client/md-client.js",
        "%gpii-handlebars/src/js/client/renderer.js",
        "%gpii-handlebars/src/js/common/equals.js",
        "%gpii-handlebars/src/js/common/helper.js",
        "%gpii-handlebars/src/js/common/jsonify.js",
        "%gpii-handlebars/src/js/common/md-common.js"
    ]
});

bundlePromise.then(
    function () { fluid.log("Saved static abledata site to /tmp/abledata-sandbox."); },
    fluid.fail
);
