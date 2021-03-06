"use strict";

const os = require("os");
const { join } = require("path");
const api = require("api.io");
const Web = require("web");
const RestClient = require("restclient");
const { Service } = require("service");
const MgmtMgr = require("./managers/mgmt");

const Apis = [
    require("./apis/rest"),
    require("./apis/type")
];

class Main extends Service {
    constructor(name, version) {
        super(name, version);
        this.productionMode = process.env.NODE_ENV === "production";
    }

    async onSetup() {
        await this.provide("REST", {
            uri: `http://${os.hostname()}:${this.config.web.port}`
        });
    }

    async onOnline() {
        // Add dependencies to all services without restart when they go offline
        const secondaryRestNeeds = [
            "mgmt", "ui", "exec", "baselinegen", "flowctrl", "coderepo", "userrepo", "artifactrepo", "logrepo", "eventrepo", "dataresolve"
        ];
        for (const serviceId of secondaryRestNeeds) {
            await this.want(serviceId, serviceId, RestClient);
        }

        const routes = Object.assign({}, this.routes);

        await MgmtMgr.instance.start();
        this.addDisposable(MgmtMgr.instance);
        this.mgr.addMgmtBusListener(MgmtMgr.instance.getServiceMonitorBusListener());

        const mb = this.msgBus;
        mb.addListener("data", MgmtMgr.instance.getEventMonitorBusListener());

        for (const Api of Apis) {
            await Api.instance.start();
            this.addDisposable(Api.instance);
        }

        this.config.web.serveStatic = [
            join(__dirname, "..", "client", "static"),
            join(__dirname, "..", "node_modules", "cheser-icon-theme")
        ];

        if (!this.productionMode) {
            const buildWebpackCfg = require("../client/webpack.config.js");
            const webpack = require("webpack");
            const webpackMiddleware = require("koa-webpack-dev-middleware");

            const webpackCfg = buildWebpackCfg({ dev: true });
            this.config.web.webpackMiddleware = webpackMiddleware(
                webpack(webpackCfg), {
                    log: this.log.bind(this, "info"),
                    warn: this.log.bind(this, "warn"),
                    stats: true
                }
            );
        }

        this.config.web.api = api;

        await Web.instance.start(this.config.web, routes);
        this.addDisposable(Web.instance);

        const modeStr = this.productionMode ? "production" : "development";
        this.log("info", `I'm online in ${modeStr} mode`);
    }

    async onOffline() {
        this.log("info", "I'm offline!");
    }
}

module.exports = Main;
