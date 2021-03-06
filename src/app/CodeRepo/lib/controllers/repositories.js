"use strict";

const Repository = require("../types/repository");
const { Controller } = require("typelib");

class Repositories extends Controller {
    constructor() {
        super(Repository, [ "read", "create", "remove", "tag", "ref" ]);
        this._addGetter("uri", this._uri);
    }

    async _uri(ctx, id) {
        const obj = await this._getTypeInstance(ctx, id);

        const uri = await obj.getUri();

        if (!uri) {
            ctx.throw("No URI built", 500);
        }

        ctx.type = "json";
        // TODO: Shall uri report in another format?
        ctx.body = `${uri}\n`;
    }}

module.exports = Repositories;
