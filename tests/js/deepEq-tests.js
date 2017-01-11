// Tests for the "deep equals" functionality used when synchronising records.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%ul-import/src/js/deepEq.js");

var jqUnit = require("node-jqunit");

jqUnit.module("Tests for our 'deep equals' static functions");

jqUnit.test("Equal things should be equal...", function () {
    jqUnit.assertTrue("Two Empty objects should be equal", gpii.ul.imports.deepEq({}, {}));
    jqUnit.assertTrue("Equal strings should be equal", gpii.ul.imports.deepEq("a string", "a string"));
    jqUnit.assertTrue("Equal arrays should be equal", gpii.ul.imports.deepEq([1,1,2,3], [1,1,2,3]));
    jqUnit.assertTrue("Equal objects should be equal", gpii.ul.imports.deepEq({ bar: "foo"}, { bar: "foo"}));
    jqUnit.assertTrue("Equal numbers should be equal", gpii.ul.imports.deepEq(3.1415926, 3.1415926));
    jqUnit.assertTrue("Key ordering should not matter", gpii.ul.imports.deepEq({ bar: "foo", baz: "qux"}, { baz: "qux", bar: "foo"}));
});

jqUnit.test("Unequal things should be unequal...", function () {
    jqUnit.assertFalse("Unequal objects should not be equal", gpii.ul.imports.deepEq({}, { foo: "bar"}));
    jqUnit.assertFalse("Unequal strings should not be equal", gpii.ul.imports.deepEq("a string", "a different string"));
    jqUnit.assertFalse("Unequal arrays should not be equal", gpii.ul.imports.deepEq([1,1,2,3], [3,2,1,1]));
    jqUnit.assertFalse("Unequal numbers should not be equal", gpii.ul.imports.deepEq(Math.PI, 3.1415926));
    jqUnit.assertFalse("An object and its string equivalent should not be equal", gpii.ul.imports.deepEq({}, "{}"));
});

jqUnit.test("Filtered comparisons should work as expected...", function () {
    jqUnit.assertTrue("Including only matching filtered content should work...", gpii.ul.imports.filteredDeepEq({ foo: "bar", baz: "qux"}, {foo: "bar", qux: "quux"}, ["foo"]));
    jqUnit.assertTrue("Excluding mismatching content should work...", gpii.ul.imports.filteredDeepEq({ foo: "bar", baz: "qux"}, {foo: "bar", qux: "quux"}, ["baz", "qux"], true));
});
