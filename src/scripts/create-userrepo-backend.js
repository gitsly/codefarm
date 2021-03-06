"use strict";

const fs = require("fs-extra-promise");
const yargs = require("yargs");
const path = require("path");
const rp = require("request-promise");
const { userrepo: configUserRepo } = require("./config.json");

const argv = yargs
.help("help")
.strict()
.option("i", {
    alias: "id",
    describe: "Backend id",
    type: "string",
    requiresArg: true,
    default: "Dummy"
})
.option("t", {
    alias: "type",
    describe: "Backend type",
    type: "string",
    requiresArg: true,
    default: "dummy"
})
.argv;

const run = async () => {
    console.log(`Adding backend ${argv.id}`);
    let result = await rp.post({
        url: `http://localhost:${configUserRepo.web.port}/backend`,
        body: {
            _id: argv.id,
            backendType: argv.type
        },
        json: true
    });

    console.dir(result, { colors: true, depth: null });
}

run()
.catch((error) => {
    console.error(error);
    process.exit(255);
});
