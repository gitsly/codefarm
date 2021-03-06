"use strict";

const vm = require("vm");
const { ServiceMgr } = require("service");
const { assertType, assertProp } = require("misc");
const { Type } = require("typelib");

class Step extends Type {
    constructor(data) {
        super();

        this.name = false;
        this.flow = false;
        this.schedule = false;
        this.concurrency = 1;
        this.baseline = false;
        this.criteria = false;
        this.script = false;
        this.tagScript = false;
        this.parentSteps = [];
        this.visible = true;

        this.jobs = [];

        if (data) {
            this.set(data);
        }
    }

    static get serviceName() {
        return ServiceMgr.instance.serviceName;
    }

    static get typeName() {
        return "step";
    }

    static async _getDb() {
        return await ServiceMgr.instance.use("db");
    }

    static async _getMb() {
        return ServiceMgr.instance.msgBus;
    }

    async _getRestClientByType(type) {
        const [ serviceId, typeName ] = type.split(".");

        if (!ServiceMgr.instance.has(serviceId)) {
            throw new Error(`Unknown type (${type})`);
        }

        const restClient = await ServiceMgr.instance.use(serviceId);

        return {
            serviceId,
            typeName,
            restClient: restClient
        };
    }

    static async validate(event, data) {
        assertProp(data, "_id", false);
        assertProp(data, "jobIds", false);

        if (data.concurrency) {
            data.concurrency = parseInt(data.concurrency, 10);
        }

        if (event === "create") {
            assertProp(data, "name", true);
            assertType(data.name, "data.name", "string");
            assertProp(data, "flow", true);
            assertType(data.flow, "data.flow", "string");
            assertProp(data, "concurrency", true);
            assertType(data.concurrency, "data.concurrency", "number");
            assertProp(data, "baseline", true);
            assertType(data.baseline, "data.baseline", "string");
            // assertType(data.script, "data.parentSteps", "array"); TODO: This does not work correctly
        }
    }

    async evaluateStatus(evaluateJobs = false) {
        if (evaluateJobs) {
            if (this.jobs.length > 0) {
                const jobIds = this.jobs.map((job) => job.jobId);
                const exec = await ServiceMgr.instance.use("exec");

                try {
                    const finishedJobs = await exec.get("/job", {
                        _id: {
                            $in: jobIds
                        },
                        result: {
                            $ne: false
                        }
                    });

                    for (const job of finishedJobs) {
                        ServiceMgr.instance.log("info", `Step ${this.name} found job ${job._id} which has finished, performing step job finish`);
                        await this.finishJob(job._id, job.status);
                    }
                } catch (error) {
                    ServiceMgr.instance.log("error", `Step ${this.name} failed to request finished jobs`, error);
                }
            }
        }

        if (!this.schedule) {
            if (this.jobs.length < this.concurrency) {
                try {
                    await this.requestBaseline();
                } catch (error) {
                    ServiceMgr.instance.log("error", `Step ${this.name} failed to request baseline ${this.baseline}`, error);
                }
            }
        } else {
            // TODO: Check time against schedule
        }
    }

    async requestBaseline() {
        const baselineGen = await ServiceMgr.instance.use("baselinegen");

        ServiceMgr.instance.log("verbose", `Step ${this.name} requesting baseline ${this.baseline}`);

        const result = await baselineGen.post(`/specification/${this.baseline}/request`);

        if (result.result !== "success") {
            throw Error(`Failed to request new baseline: ${result.error}`);
        }
    }

    async triggerJob(baseline) {
        if (!this.script) {
            await this.evaluateStatus();

            return await this.runTagScript(null, baseline, "success");
        }

        ServiceMgr.instance.log("verbose", `Step ${this.name} creating exec.job`);

        const exec = await ServiceMgr.instance.use("exec");

        const result = await exec.post("/job", {
            name: this.name,
            criteria: this.criteria,
            script: this.script,
            baseline: baseline
        });

        if (result.result !== "success") {
            throw Error(`Failed to spawn job log: ${result.error}`);
        }

        this.jobs.push({ jobId: result.data._id, baseline: baseline });
        await this.save();

        for (const ref of baseline.content) {
            const { typeName, restClient } = await this._getRestClientByType(ref.type);

            for (const id of ref.id) {
                await restClient.post(`/${typeName}/${id}/addref`, {
                    ref: {
                        _ref: true,
                        id: result.data._id,
                        type: result.data.type,
                        name: this.name
                    }
                });
            }
        }
    }

    async abortJobs() {
        const exec = await ServiceMgr.instance.use("exec");

        const jobIds = this.jobs.map((job) => job.jobId);
        this.jobs.length = 0;
        await this.save();

        for (const jobId of jobIds) {
            await exec.remove(`/job/${jobId}`);
        }
    }

    async finishJob(jobId, result) {
        ServiceMgr.instance.log("verbose", `Step ${this.name} finishing job, result=${result}`);
        const index = this.jobs.findIndex((job) => job.jobId === jobId);
        const job = this.jobs[index];

        this.jobs.splice(index, 1);
        await this.save();

        await this.evaluateStatus();

        await this.runTagScript(jobId, job.baseline, result);
    }

    async runTagScript(jobId, baseline, result) {
        const defaultTag = `step:${this.name}:${result}`;
        const sandbox = {
            data: {
                id: this._id,
                name: this.name,
                jobId: jobId,
                flowId: this.flow,
                baselineId: baseline._id,
                content: {},
                result: result
            },
            tags: [ defaultTag ],
            untag: []
        };

        if (this.tagScript) {
            ServiceMgr.instance.log("verbose", `Step ${this.name} running tag script`);
            for (const ref of baseline.content) {
                const { typeName, restClient } = await this._getRestClientByType(ref.type);

                sandbox.data.content[ref.name] = [];

                for (const id of ref.id) {
                    sandbox.data.content[ref.name].push(await restClient.get(`/${typeName}/${id}`));
                }
            }

            const script = new vm.Script(this.tagScript);
            script.runInNewContext(sandbox);
        }

        for (const ref of baseline.content) {
            const { typeName, restClient } = await this._getRestClientByType(ref.type);

            for (const id of ref.id) {
                if (sandbox.tags.length > 0) {
                    await restClient.post(`/${typeName}/${id}/tag`, {
                        tag: sandbox.tags
                    });
                }

                if (sandbox.untag.length > 0) {
                    await restClient.post(`/${typeName}/${id}/untag`, {
                        tag: sandbox.untag
                    });
                }
            }
        }

        // Important to tag baseline after baseline content has been tagged!
        const { restClient } = await this._getRestClientByType("baselinegen.baseline");

        await restClient.post(`/baseline/${baseline._id}/tag`, {
            tag: defaultTag
        });
    }
}

module.exports = Step;
