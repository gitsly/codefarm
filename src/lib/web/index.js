"use strict";

const Koa = require("koa");
const send = require("koa-send");
const route = require("koa-route");
const bodyParser = require("koa-bodyparser");
const compress = require("koa-compress");
const conditional = require("koa-conditional-get");
const etag = require("koa-etag");
const serve = require("koa-static");
const { AsyncEventEmitter } = require("emitter");
const { ensureArray } = require("misc");

let instance;

class Web extends AsyncEventEmitter {
    constructor() {
        super();

        this.app = null;
        this.server = null;
    }

    static get instance() {
        if (!instance) {
            instance = new this();
        }

        return instance;
    }

    async start(params, routes, statusRouteName = "/status") {
        this.app = new Koa();

        this.app.use(compress());
        this.app.use(bodyParser({ enableTypes: [ "json", "form", "text" ] }));
        this.app.use(conditional());
        this.app.use(etag());

        this.app.use(async (ctx, next) => {
            try {
                await next();
            } catch (error) {
                console.error(error);
                console.error(error.stack);
                ctx.status = error.status || 500;
                ctx.type = "json";
                ctx.body = JSON.stringify({ result: "fail", error: error.message || error }, null, 2);
            }
        });

        const staticPaths = ensureArray(params.serveStatic);

        for (const staticPath of staticPaths) {
            this.app.use(serve(staticPath));
        }

        const apiDocRows = [];

        for (const name of Object.keys(routes)) {
            if (name === "unamed") {
                for (const fn of routes.unamed()) {
                    this.app.use(fn);
                }
            } else {
                let method = "get";
                let routeName = name;

                if (name[0] !== "/") {
                    [ , method, routeName ] = name.match(/(.+?)(\/.*)/);
                }

                this.app.use(route[method](routeName, routes[name]));
                apiDocRows.push({
                    "method": method,
                    "route": routeName,
                    "description": ""
                });
            }
        }

        // Route for showing web server status including the exposed API
        this.app.use(route.get(statusRouteName, async (ctx) => {
            const rows = apiDocRows.map((item) =>
                `<tr>
                    <td>${item.method}</td>
                    <td>${item.route}</td>
                    <td>${item.description}</td>
                <tr>`).join("\n");

            const body = `
            <html>
                <head></head>
                <body>
                    <h1>Status</h1>
                    <h2>API</h2>
                    <table>
                        <tr>
                            <th>Method</th>
                            <th>Route</th>
                            <th>Description</th>
                        </tr>
                        ${rows}
                    </table>
                </body>
            </html>`;

            ctx.type = "html";
            ctx.body = body;
        }));

        if (params.webpackMiddleware) {
            this.app.use(params.webpackMiddleware);
        }

        if (staticPaths.length > 0) {
            this.app.use(route.get("*", async (ctx) => await send(ctx, "/index.html", { root: staticPaths[0] })));
        }

        this.server = this.app.listen(params.port);

        if (params.api) {
            this.api = params.api;
            await this.api.start(this.server);
        }

        await this.emit("start", { port: params.port });
    }

    async dispose() {
        if (this.api) {
            await this.api.stop();
            this.api = null;
        }
        if (this.server) {
            this.server.close();
        }

        this.server = null;
        this.app = null;

        await this.emit("dispose");

        this.removeAllListeners();
    }
}

module.exports = Web;
