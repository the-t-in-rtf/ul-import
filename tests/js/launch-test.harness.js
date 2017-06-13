// A convenience script to start up a copy of the test harness for manual QA.
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii = fluid.registerNamespace("gpii");

require("./test-harness");

gpii.tests.ul.imports.harness({
    ports: {
        couch: 9899,
        api:   3599
    },
    components: {
        pouch: {
            options: {
                components: {
                    pouch: {
                        options: {
                            databases: {
                                ul:    {
                                    data: "%ul-api/tests/data/views.json"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});
