"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../deepEq");

fluid.defaults("gpii.ul.imports.sai.transformer.firstSaneValue", {
    gradeNames: "fluid.standardOutputTransformFunction"
});

fluid.registerNamespace("gpii.ul.imports.sai.transformer");

// This function is required because undefined values are represented as empty arrays in the SAI.
gpii.ul.imports.sai.transformer.firstSaneValue = function (transformSpec, transformer) {
    var sanitizedTransformSpec = fluid.copy(transformSpec);

    sanitizedTransformSpec.values = fluid.transform(sanitizedTransformSpec.values, function (value) {
        var expanded = transformer.expand(value);

        if (expanded === "" || gpii.ul.imports.deepEq([], expanded)) {
            return "notfound";
        }
        else {
            return value;
        }
    });

    return fluid.transforms.firstValue(sanitizedTransformSpec, transformer);
};
