// A wrapper for the "deep equals" comparisons used to determine if a record has been updated.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var deepEqual = require("deep-equal");

fluid.registerNamespace("gpii.ul.imports");

/**
 *
 * A function that wraps deep-equal (equivalent to assert.deepEqual in node) to deeply compare two objects.
 *
 * @param a The first object to compare.
 * @param b The second object to compare
 * @returns true if the objects are deeply equal, false otherwise.
 *
 */
gpii.ul.imports.deepEq = function (a, b) {
    return deepEqual(a, b, { strict: true});
};

/**
 *
 * A function that uses fluid.filterKeys to compare only part of two objects.
 *
 * @param a The first object to compare.
 * @param b The second object to compare.
 * @param keys The keys to include (by default) in the comparison.
 * @param exclude If this is set to true, we will exclude the above keys instead.
 * @returns {*}
 *
 */
gpii.ul.imports.filteredDeepEq = function (a, b, keys, exclude) {
    var filteredA = fluid.filterKeys(a, keys, exclude);
    var filteredB = fluid.filterKeys(b, keys, exclude);

    return gpii.ul.imports.deepEq(filteredA, filteredB);
};
