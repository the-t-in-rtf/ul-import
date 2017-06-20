# Unified Listing Imports

This package contains scripts that are used to import data from vendor databases.

## "Core" Imports

The general process of importing data from a vendor is as follows:

1. Check for a local cache of vendor records (to avoid downloading data too frequently).
2. If the cache is found, load the records.  If not, download all vendor data in batches, making no more than 100 requests simultaneously.
3. Transform the vendor records into "source" records.
4. Retrieve the list of records for the vendor source(s) and compare them to the newly-retrieved records.  If there are new records, create them.  If there are updated versions of existing records, update them. 

## The "Unifier"

Through the web interface and various API endpoints, by default only "unified" records are displayed.  The "unifier"
is a script that looks for any "source" records that are not already associated with a "unified" record.  For each of
these "orphaned" records it finds, the "unifier":

1. Creates a new "unified" record using the same "title", "description", "manufacturer", etc. data from the "source" record.
2. Updates the "source" record to indicate that it is associated with the new "unified" record.

## "Image" Imports

There is a secondary set of scripts that:

1. Extract image data from "source" records.
2. Download the original images and cache them locally as needed.
3. Update the associated "unified" record to indicate that it has image data.

For this script to work properly, it should be run after the "unifier" has completed its work (see below).

## Performing a Full Sync

The basic process for performing a full sync is as follows:

1. Run each of the "core" imports.
2. Run the "unifier".
3. Run each of the "image" imports.

## Syncing Using NPM

This package has a few `npm` scripts defined to cover each part of the above.  To run a "full" sync, use a command like:

`npm run full-sync`

For individual commands, see the `package.json` file.  Note that all of the npm scripts are hard-coded to use the
"production" configuration settings.  To run in a dev environment, you will need to run the direct commands (see below).

## Syncing Using Direct Commands

This package provides a range of scripts that use [`gpii-launcher`](https://www.npmjs.com/package/gpii-launcher) to
run various commands, and to change the effective options used when running the command using options files,
command-line switches, and environment variables.  The `configs` directory contains a range of configuration files.
Usually, you will want to work with one of the "merged" config files that combines:

1. Options common to all scripts.
2. Options common to the operating environment (production, development).
3. Options common to all scripts that work with a particular vendor's data (EASTIN, GARI, et cetera).
4. Options specific to a particular script.

All commands provided below are intended to be run from root of the directory in which the repository has been checked
out.

### EASTIN

The Unified Listing pulls "source" records from [EASTIN](http://www.eastin.eu/en/searches/products/index), which is
itself a federation of various partner databases ([see their website for details](http://www.eastin.eu/en/partners/index)).

To import "core" data from EASTIN:
 1. In production: `npm run eastin-import`
 2. In a development environment: `node src/js/eastin/launcher.js --optionsFile %ul-imports/configs/eastin-dev.json`

To import "image" data from EASTIN:
 1. In production: `npm run eastin-image-import`
 2. In a development environment: `node src/js/images/eastin-image-sync.js --optionsFile %ul-imports/configs/eastin-image-sync-dev.json`


### GARI

The Unified Listing pulls "source" records from [GARI](http://www.gari.info).  To import "core" data from GARI:
 
 1. In a production environment:  `npm run gari-import`
 2. In a development environment: `node src/js/gari/index.js --optionsFile %ul-imports/configs/gari-dev.json`

To import "image" data from GARI:

1. In production: `npm run gari-image-import`
2. In a development environment: `node src/js/images/gari-image-sync.js --optionsFile %ul-imports/configs/gari-image-sync-dev.json`

### The SAI

The Shopping and Alerting Aid is a front-end to the Unified Listing to assist users in finding products that meet their
needs.  To import "core" data from the SAI:

1. In production: `npm run sai-import`
2. In a development environment: `node src/js/sai/index.js --optionsFile %ul-imports/configs/sai-dev.json`

To import "image" data from the SAI:

1. In production: `npm run sai-image-import`
2. In a development environment: `node src/js/images/sai-image-sync.js --optionsFile %ul-imports/configs/sai-image-sync-dev.json`

### "Unifier"

See above for details regarding the "unifier".  To create a "unified" record for each "source" record that is not
already associated with a "unified" record:

1. In production: ```npm run unifier```
2. In a development environment: ```node src/js/unifier/index.js --optionsFile %ul-imports/configs/unifier-dev.json```