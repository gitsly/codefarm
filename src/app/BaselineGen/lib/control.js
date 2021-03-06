"use strict";

const { synchronize } = require("misc");
const { ServiceMgr } = require("service");
const { notification } = require("typelib");
const Specification = require("./types/specification");
const Collector = require("./types/collector");
const Baseline = require("./types/baseline");

let instance;

class Control {
    constructor() {
        synchronize(this, "update");
        synchronize(this, "generate");
    }

    static get instance() {
        if (!instance) {
            instance = new this();
        }

        return instance;
    }

    // TODO: Maybe we need some sort of common lock around generate and update

    async start() {
        const mb = ServiceMgr.instance.msgBus;

        notification.on("specification.created", async (specification) => {
            for (const data of specification.collectors) {
                await Collector.createFromSpecificationData(specification._id, data);
            }
        });

        notification.on("specification.updated", async (specification) => {
            const requested = await Collector.stopAllByBaselineName(specification._id);

            for (const data of specification.collectors) {
                await Collector.createFromSpecificationData(specification._id, data, requested);
            }
        });

        notification.on("specification.removed", async (specification) => {
            await Collector.stopAllByBaselineName(specification._id);
        });

        // TODO: Handle specification update which adds new and remove

        notification.on("collector.complete", async (collector) => {
            const specification = await Specification.findOne({ _id: collector.baseline });

            if (specification) {
                const data = specification.collectors.filter((data) => data.name === collector.name)[0];

                if (data) {
                    await Collector.createFromSpecificationData(specification._id, data);
                }
            }
        });

        notification.on("collector.ready", async (collector) => {
            await this.generate(collector.baseline, false);
        });

        notification.on("specification.request", async (specification) => {
            await this.generate(specification._id, true);
        });

        mb.on("data", async (event) => {
            await this.update(event);
        });
    }

    async update(event) {
        if (event.event === "created" || event.event === "updated") {
            const collectors = await Collector.findMatching(event);

            for (const collector of collectors) {
                await collector.update(event);
            }
        }
    }

    async generate(baselineName, request = false) {
        const collectors = await Collector.findLatest(baselineName);

        if (collectors.length === 0) {
            // TODO: Print error?
            return;
        }

        const readyCollectors = collectors.filter((collector) => collector.ready);

        if (readyCollectors.length !== collectors.length) {
            // Baseline is not ready

            if (request) {
                for (const collector of collectors) {
                    if (!collector.requested) {
                        collector.requested = new Date();
                        await collector.save();
                    }
                }
            }

            return;
        }

        if (request || collectors[0].requested) {
            for (const collector of collectors) {
                collector.completed = collector.completed || new Date();
                collector.used = new Date();
                await collector.save();
            }

            const baseline = new Baseline({
                name: baselineName,
                content: collectors.map((collector) => {
                    return {
                        _ref: true,
                        name: collector.name,
                        type: collector.collectType,
                        id: collector.ids
                    };
                })
            });

            await baseline.save();
        }
    }

    async dispose() {
        notification.removeAllListeners("specification.created");
        notification.removeAllListeners("collector.complete");
        notification.removeAllListeners("collector.ready");
        notification.removeAllListeners("specification.request");
    }
}

module.exports = Control;
