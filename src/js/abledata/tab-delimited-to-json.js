/* eslint-env node */
"use strict";
var fluid = require("infusion");

var fs = require("fs");
var csv = require("fast-csv");

require("../bundle-deps");

var filename = "/Users/duhrer/Downloads/AbleData/All Abledata Data.txt";
var stream = fs.createReadStream(filename);

var uniqueValues = function (rawString) {
    var tmpObject = {};
    var segments = rawString.split(/ ?, ?/);
    fluid.each(segments, function (segment) {
        tmpObject[segment] = true;
    });

    return Object.keys(tmpObject).sort();
};

var row = 0;
var headings = [];
var jsonData = [];
var csvStream = csv({ delimiter: "\t"})
    .on("data", function (data) {
        if (row === 0) {
            headings = data;
        }
        else if (data[2] && data[2] === "Available") {
            var singleRecord = {};
            for (var a = 0; a < data.length; a++) {
                var value = a === 3 ? uniqueValues(data[a]) : data[a];
                if (value.length) {
                    singleRecord[headings[a].toLowerCase() || "field" + a] = value;
                }
            }
            jsonData.push(singleRecord);
        }
        row++;
    })
    .on("end", function () {
        console.log("Processed ", row, " rows of data and found ", jsonData.length, " available records.");

        fs.writeFileSync("/tmp/output.json", JSON.stringify(jsonData, null, 2));
        console.log("Saved raw output.");

        var fd = fs.openSync("/tmp/abledata-data.js", "w");
        fs.writeSync(fd, "(function(fluid){\n");
        fs.writeSync(fd, "var gpii = fluid.registerNamespace(\"gpii\");\n");
        fs.writeSync(fd, "fluid.registerNamespace(\"gpii.ul.import.ableData\");\n");
        fs.writeSync(fd, "gpii.ul.import.ableData = ");
        fs.writeSync(fd, JSON.stringify(jsonData, null, 2));
        fs.writeSync(fd, ";\n})(fluid);");
        fs.closeSync(fd);
        console.log("Saved data as namespaced javascript source.");
    });

stream.pipe(csvStream);
