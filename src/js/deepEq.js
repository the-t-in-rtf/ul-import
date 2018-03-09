// A wrapper for the "deep equals" comparisons used to determine if a record has been updated.
"use strict";
var fluid = require("infusion");
fluid.setLogging(false);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-diff");
fluid.registerNamespace("gpii.ul.imports");

/**
 *
 * A function that uses `fluid.filterKeys` to compare only part of two objects.
 *
 * @param a The first object to compare.
 * @param b The second object to compare.
 * @param keys The keys to include (by default) in the comparison.
 * @param exclude If this is set to true, we will exclude the above keys instead.
 * @return {*}
 *
 */
gpii.ul.imports.filteredDeepEq = function (a, b, keys, exclude) {
    var filteredA = fluid.filterKeys(a, keys, exclude);
    var filteredB = fluid.filterKeys(b, keys, exclude);

    return gpii.diff.equals(filteredA, filteredB);
};
