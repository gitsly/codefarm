"use strict";

const { serviceMgr } = require("service");
const path = require("path");
const fs = require("fs-extra-promise");
const send = require("koa-send");

class FsBackend {
    constructor(name, params) {
        this.name = name;
        this.params = params;
    }

    async start() {
    }

    _getBasePath(repository) {
        return path.join(this.params.path, repository._id);
    }

    _getLogPath(repoPath, log) {
        /* Assume _id is an uuid-v4 with dashes. Split by dash to
         * limit the number of nodes per directory a little bit... */
        const repPathParts = log._id.split("-");
        // Use last part as filename, rest as directory-structure
        const filename = repPathParts.pop();
        const dir = path.join(repoPath, ...repPathParts);
        const absPath = path.join(dir, filename);

        return { absPath, dir, filename };
    }

    async _assertRepo(repoPath, expectExist = true) {
        const exist = await fs.existsAsync(repoPath);
        if (expectExist && !exist) {
            throw new Error("Repository location does not exist");
        } else if (!expectExist && exist) {
            throw new Error("Repository location already exist");
        }
    }

    async createRepo(repository) {
        const repoPath = this._getBasePath(repository);

        // TODO: Fix possible race, dir might be created between existsAsync and mkdirsAsync
        await this._assertRepo(repoPath, false);

        await fs.mkdirsAsync(repoPath);
    }

    async updateRepo(/* repository */) {
    }

    async removeRepo(repository) {
        const repoPath = this._getBasePath(repository);

        await this._assertRepo(repoPath);

        await fs.removeAsync(repoPath);
    }

    makeFileName(repository, id) {
        return path.join(this._getBasePath(repository), id.replace(/-/g, "/"));
    }

    async saveLog(repository, log) {
        const filename = this.makeFileName(repository, log._id);
        await fs.ensureFileAsync(filename);
    }

    async appendLog(repository, id, data) {
        try {
            await fs.appendFileAsync(this.makeFileName(repository, id), data);
            // TODO: Notify of update somewhere
        } catch (error) {
            serviceMgr.log("error", `Error when appending to log id = ${id} data = ${data} error = (${error})`);
        }
    }

    async uploadLog(repository, log, fileStream) {
        const repoPath = this._getBasePath(repository);
        const { absPath: logFilePath, dir: logDir } = this._getLogPath(repoPath, log);

        await this._assertRepo(repoPath);

        // Okay not to check for collisions? This is handled at type level in db?

        await fs.mkdirsAsync(logDir);

        const result = {
            storagePath: logFilePath
        };

        return new Promise((resolve, reject) => {
            fileStream
                .pipe(fs.createWriteStream(logFilePath))
                .on("finish", () => resolve(result))
                .on("error", reject);
        });
    }

    async downloadLog(repository, log, ctx) {
        const repoPath = this._getBasePath(repository);
        const { dir: logDir, filename: logFilename } = this._getLogPath(repoPath, log);

        await this._assertRepo(repoPath);

        await send(ctx, logFilename, {
            root: logDir
        });
    }

    async getLogReadStream(repository, log, ctx) {
        const repoPath = this._getRepoPath(repository);
        const { absPath: logFilePath } = this._getLogPath(repoPath, log);

        await this._assertRepo(repoPath);
        if (!(await fs.existsAsync(logFilePath))) {
            ctx.throw("Artifact file doesn't exist", 404);
        }

        return fs.createReadStream(logFilePath);
    }

    async removeLog(repository, log) {
        const repoPath = this._getRepoPath(repository);
        const { absPath: logFilePath } = this._getLogPath(repoPath, log);

        await this._assertRepo(repoPath);

        // TODO: Fix possible race, dir might be created between existsAsync and writeFileAsync
        if (!(await fs.existsAsync(logFilePath))) {
            throw new Error("Artifact location doesn't exist");
        }

        await fs.removeAsync(logFilePath);
    }

    async dispose() {
    }
}

module.exports = FsBackend;
