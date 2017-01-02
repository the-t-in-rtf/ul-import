// A set of additional transforms to assist in migrating data.
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.transforms");

fluid.require("%universal/gpii/node_modules/settingsHandlers/index");

// These functions have no configuration available, so we are fine with the implied `fluid.standardTransformFunction` grade

gpii.ul.imports.transforms.toLowerCase = function (rawValue) {
    return (typeof rawValue === "string") ? rawValue.toLowerCase() : rawValue;
};

fluid.defaults("gpii.ul.imports.transforms.toLowerCase", {
    gradeNames: ["fluid.standardTransformFunction"]
});


gpii.ul.imports.transforms.trim = function (rawValue) {
    return (typeof rawValue === "string") ? rawValue.trim() : rawValue;
};

fluid.defaults("gpii.ul.imports.transforms.trim", {
    gradeNames: ["fluid.standardTransformFunction"]
});


// A generic transformer to extract matches for a given regexp.  Expects to be configured with `options.regexp`
fluid.registerNamespace("gpii.ul.imports.transforms.regexp");

gpii.ul.imports.transforms.regexp = function (value, transformSpec) {
    if (!transformSpec.regexp) {
        fluid.fail("You must pass a regexp option to use the regexp transformer");
    }

    var regexp = new RegExp(transformSpec.regexp);
    if (typeof value === "string") {
        var matches = value.match(regexp);

        if (matches) {
            // Returns the first (greediest) match
            return matches[0];
        }
    }

    // If we find no matches, return the original content
    return value;
};

fluid.defaults("gpii.ul.imports.transforms.regexp", {
    gradeNames: ["fluid.standardTransformFunction"]
});


// The output of gpii.settingsHandlers.XMLHandler.parser.parse() attempts to handle XML with both text and child values.
//
// Given XML like:
// `<?xml version=1.0><foo><bar>text<baz>more text</baz></bar><qux></qux></foo>`
//
// It would produce a JSON object like:
// {
//   foo: {
//     bar: {
//       $t: "text",
//       baz: {
//         $t: "more text"
//       }
//     },
//     qux: {
//     }
//   }
// }
//
// This transformer checks to see if $t is the only property at this level, and if so, collapses it.
//
// It also treats empty properties as undefined.
//
// Given the JSON above, it would produce:
//
// {
//   foo: {
//     bar: {
//       $t: "text",
//       baz: "more text"
//     }
//   }
// }
//
// It will err on the side of preserving existing child data, when both $t and other properties are found, it will keep both.
gpii.ul.imports.transforms.flatten = function (value) {
    if (Array.isArray(value)) {
        var otherArray = [];
        value.forEach(function (arrayValue) {
            otherArray.push(gpii.ul.imports.transforms.flatten(arrayValue));
        });
        return otherArray;
    }
    else if (typeof value === "object") {
        var hasT = value.hasOwnProperty("$t");
        var otherProperties = {};
        Object.keys(value).forEach(function (property) {
            if (value.hasOwnProperty(property) && property !== "$t") {
                var flattened = gpii.ul.imports.transforms.flatten(value[property]);
                otherProperties[property] = flattened;
            }
        });

        if (hasT && Object.keys(otherProperties).length === 0) {
            return value.$t;
        }
        else if (hasT) {
            otherProperties.$t = value.$t;
        }
        // Empty braces are treated as "undefined"
        else if (Object.keys(otherProperties).length === 0) {
            return undefined;
        }

        return otherProperties;
    }
    else {
        return value;
    }
};

fluid.defaults("gpii.ul.imports.transforms.flatten", {
    gradeNames: ["fluid.standardTransformFunction"]
});


// Strip null values from an Object.
//
// An object like: `{ foo: null, bar: "not null", baz: undefined }`
//
// Would become: `{ bar: "not null" }`
//
// Notably, this should not strip empty strings.
gpii.ul.imports.transforms.stripNonValues = function (value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    else if (Array.isArray(value)) {
        var strippedArray = [];
        value.forEach(function (arrayValue) {
            strippedArray.push(gpii.ul.imports.transforms.stripNonValues(arrayValue));
        });
        return strippedArray;
    }
    else if (typeof value === "object") {
        var strippedObject = {};
        Object.keys(value).forEach(function (property) {
            if (value.hasOwnProperty(property)) {
                var stripped = gpii.ul.imports.transforms.stripNonValues(value[property]);
                if (stripped !== null && stripped !== undefined) {
                    strippedObject[property] = stripped;
                }
            }
        });

        return strippedObject;
    }

    return value;
};

fluid.defaults("gpii.ul.imports.transforms.stripNonValues", {
    gradeNames: ["fluid.standardTransformFunction"]
});
