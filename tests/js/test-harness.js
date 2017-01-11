// The common test harness we will use for all tests as well as manual verification.
"use strict";
var fluid = require("infusion");

require("../../");

fluid.require("%ul-api/tests/js/lib/test-harness.js");

fluid.defaults("gpii.tests.ul.imports.harness", {
    gradeNames: ["gpii.tests.ul.api.harness"],
    ports: {
        api:    3579,
        couch:  9753
    },
    urls: {
        api: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["http://localhost:%port", { port: "{that}.options.ports.api"}]
            }
        },
        login: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["http://localhost:%port/api/user/login", { port: "{that}.options.ports.api"}]
            }
        },
        product: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["http://localhost:%port/api/product", { port: "{that}.options.ports.api"}]
            }
        },
        products: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["http://localhost:%port/api/products", { port: "{that}.options.ports.api"}]
            }
        }
    },
    listeners: {
        "onCreate.constructFixtures": {
            func: "{that}.events.constructFixtures.fire"
        },
        "onDestroy.stopFixtures": {
            func: "{that}.events.stopFixtures.fire"
        }
    },
    components: {
        express: {
            type: "gpii.express.withJsonQueryParser",
            createOnEvent: "constructFixtures",
            options: {
                // gradeNames: ["gpii.express.user.withRequiredMiddleware"],
                port :   "{harness}.options.ports.api",
                templateDirs: "{harness}.options.templateDirs",
                events: {
                    apiReady: null,
                    onReady: {
                        events: {
                            apiReady: "apiReady",
                            onStarted: "onStarted"
                        }
                    }
                },
                listeners: {
                    onReady:   {
                        func: "{harness}.events.apiReady.fire"
                    },
                    onStopped: {
                        func: "{harness}.events.apiStopped.fire"
                    }
                },
                components: {
                    api: {
                        type: "gpii.ul.api",
                        options: {
                            templateDirs: "{harness}.options.templateDirs",
                            priority: "after:jsonQueryParser",
                            urls:     "{harness}.options.urls",
                            listeners: {
                                "onReady.notifyParent": {
                                    func: "{harness}.events.apiReady.fire"
                                }
                            }
                        }
                    },
                    inline: {
                        type: "gpii.handlebars.inlineTemplateBundlingMiddleware",
                        options: {
                            priority: "after:api",
                            path: "/hbs",
                            templateDirs: "{harness}.options.templateDirs"
                        }
                    },
                    modules: {
                        type: "gpii.express.router.static",
                        options: {
                            priority: "after:api",
                            path: "/modules",
                            content: "%ul-api/node_modules"
                        }
                    }
                }
            }
        },
        pouch: {
            options: {
                components: {
                    pouch: {
                        options: {
                            databases: {
                                ul:    {
                                    data: [
                                        "%ul-import/tests/data/existing.json",
                                        "%ul-api/tests/data/views.json",
                                        // "empty" bulk documents to avoid loading the default data from the parent grade.
                                        // TODO: Replace these once gpii-pouchdb is updated to use "database components" - https://issues.gpii.net/browse/GPII-2163
                                        "%ul-import/tests/data/empty.json",
                                        "%ul-import/tests/data/empty.json",
                                        "%ul-import/tests/data/empty.json"
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});
