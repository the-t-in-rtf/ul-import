/* eslint-env node */
"use strict";

var fs = require("fs");
var csv = require("fast-csv");

require("../bundle-deps");

var filename = "/Users/duhrer/Downloads/AbleData/abledata-duplicates.csv";
var stream = fs.createReadStream(filename);

var row = 0;
var jsonData = [];
var csvStream = csv({ delimiter: ";"})
    .on("data", function (data) {
        if (row > 0 && data[0] && data[0].length && data[6] && data[6].length) {
            var singleRecord = {
                source: "AbleData",
                sid: data[0],
                uid: data[6]
            };
            jsonData.push(singleRecord);
        }
        row++;
    })
    .on("end", function () {
        console.log("Processed ", row, " rows of data and found ", jsonData.length, " available records.");

        fs.writeFileSync("/tmp/abledata-duplicates.json", JSON.stringify(jsonData, null, 2));
        console.log("Saved raw output.");

        //var fd = fs.openSync("/tmp/abledata-data.js", "w");
        //fs.writeSync(fd, "(function(fluid){\n");
        //fs.writeSync(fd, "var gpii = fluid.registerNamespace(\"gpii\");\n");
        //fs.writeSync(fd, "fluid.registerNamespace(\"gpii.ul.import.ableData\");\n");
        //fs.writeSync(fd, "gpii.ul.import.ableData = ");
        //fs.writeSync(fd, JSON.stringify(jsonData, null, 2));
        //fs.writeSync(fd, ";\n})(fluid);");
        //fs.closeSync(fd);
        //console.log("Saved data as namespaced javascript source.");
    });

stream.pipe(csvStream);
