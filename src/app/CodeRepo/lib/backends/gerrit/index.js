"use strict";

const url = require("url");
const readline = require("readline");
const fs = require("fs-extra-promise");
const moment = require("moment");
const { SshClient } = require("ssh");
const { serviceMgr } = require("service");
const { asyncWithTmo } = require("misc");
const log = require("log");
const { AsyncEventEmitter } = require("emitter");
const GerritEventEmitter = require("./gerrit_event_emitter");


const DEFAULT_GERRIT_PORT = 29418;
const DEFAULT_GERRIT_TIMEOUT = 15 * 1000;

/*
Note that localhost below needs to be changed to the host where
gerrit is running!

To get started with gerrit docker container:
1. Start container
2. Navigate to http://localhost:8080
3. Upload the public key configured for your gerrit backend to the admin user
  a. Click Become in Top-right corner
  b. Click Administrator
  c. Go to Settings (Located under user-menu in top-right corner)
  d. Click SSH Publick keys
  e. Click Add Key...
  f. Paste content of public key and click Add
4. Create repo via CodeRepo from UI or REST api

To get started with client side:
1. To clone repo, create user that will clone in gerrit
  cat /home/$USER/.ssh/id_rsa.pub | ssh -p 29418 admin@localhost gerrit create-account --full-name "'Marcus Christensson'" --email "'marcus.christensson@combitech.se'" --ssh-key - $USER
2. Clone using
  git clone ssh://$USER@localhost:29418/REPO_NAME
3. Copy gerrit hooks to local repo
  scp -p -P 29418 $USER@localhost:hooks/commit-msg REPO_ROOT/.git/hooks/
4. Set name and email in cloned repo
  git config --local user.name "Marcus Christensson"
  git config --local user.email "marcus.christensson@combitech.se"
4. When pusing changes, push with
  git push origin HEAD:refs/for/master
5. Add rights for registered users to code-review +2 and submit from gerrit UI
  a. Go to Project -> List and select Project (Repository)
  b. Select Access tab and click Edit
  c. Click "Add Reference"
  d. Reference field shall be "refs/heads/*"
  e. Click "Add Permission..." and select "Label Code Review"
  f. Enter Group Name "Registered Users"
  g. Click "Add Permission..." and select "Submit"
  h. Enter Group Name "Registered Users"
  i. Click "Save Changes"
6. Code-review +2 and submit via gerrit UI or using:
  ssh -p 29418 $USER@localhost gerrit review `git rev-parse HEAD` --code-review '+2' --submit
*/

class GerritBackend extends AsyncEventEmitter {
    constructor(id, backend, Repository, Revision) {
        super();
        this.id = id;
        this.backend = backend;
        this.locks = {};
        this.Repository = Repository;
        this.Revision = Revision;
        this.gerritEmitter = new GerritEventEmitter();

        this.__ssh = new SshClient();
    }

    async start() {
        const info = url.parse(this.backend.uri);
        const privateKey = await fs.readFileAsync(this.backend.privateKeyPath);
        const params = {
            host: info.hostname,
            port: info.port || DEFAULT_GERRIT_PORT,
            username: info.auth || process.env.USER,
            privateKey: privateKey
        };

        try {
            // TODO: Handle errors correctly from ssh client!
            await this.__ssh.connect(params, (err) => {
                throw new Error(`SSH client error: ${err}`);
            });
            await this._startMonitorEventStream();
        } catch (err) {
            log.error(`Failed to connect to gerrit using uri ${this.backend.uri}`, err);
        }
    }

    async validateRepository(/* event, data */) {
        // TODO: Validate gerrit specific options
    }

    async _readStream(stream) {
        const lines = [];
        const rl = readline.createInterface({
            input: stream,
            terminal: false
        });

        await new Promise((resolve) => {
            rl.on("line", (line) => {
                if (line.length === 0) {
                    return;
                }

                lines.push(line);
            });

            rl.on("close", resolve);
        });

        return lines;
    }

    async _execGerritCommand(cmd) {
        log.verbose("gerrit command:", cmd);

        return this.__ssh.execute(`gerrit ${cmd}`);
    }

    async _execGerritCommandReadOutput(cmd) {
        return new Promise(async (resolve) => {
            const { stdout, stderr } = await this._execGerritCommand(cmd);
            const exitCodePromise = new Promise((resolve) => stdout.on("close", resolve));
            const outLines = await this._readStream(stdout, "stdout");
            const errLines = await this._readStream(stderr, "stderr");

            if (errLines.length > 0) {
                log.error(`gerrit command: ${cmd} produced error output, stderr:`, errLines.join("\n"));
            }
            if (outLines.length > 0) {
                log.verbose(`gerrit command: ${cmd} produced output, stdout:`, outLines.join("\n"));
            }
            const exitCode = await exitCodePromise;
            resolve({ exitCode, outLines, errLines });
        });
    }

    async _onPatchsetCreated(event) {
        const changeId = event.changeKey.id;
        const repositoryId = event.project;
        const repository = await this.Repository.findOne({ _id: repositoryId });
        if (repository) {
            const revision = await this.Revision.findOne({ _id: changeId });
            const refIndex = revision ? revision.patches.length + 1 : 1;
            // TODO: Shall we use email and name from uploader?
            // TODO: Handle draft changes
            const ref = {
                index: refIndex,
                email: event.uploader.email,
                name: event.uploader.name,
                submitted: moment.unix(event.patchSet.createdOn).utc().format(),
                comment: event.change.commitMessage,
                change: {
                    oldrev: event.patchSet.parents[0],
                    newrev: event.patchSet.revision,
                    refname: event.patchSet.ref // Use event.refName all the time instead?
                }
            };

            await this.Revision.allocate(repository._id, changeId, ref);
            log.info(`Gerrit event allocated revision ${changeId}`);
        }
    }

    async _onChangeMerged(event) {
        const changeId = event.changeKey.id;
        // Make sure that we know about repo
        const repositoryId = event.project;
        const repository = await this.Repository.findOne({ _id: repositoryId });
        if (repository) {
            // And that we know about revision...
            const revision = await this.Revision.findOne({ _id: changeId });
            if (revision) {
                const ref = {
                    index: revision.patches.length + 1,
                    email: event.patchSet.uploader.email,
                    name: event.patchSet.uploader.name,
                    submitted: moment.unix(event.patchSet.createdOn).utc().format(),
                    comment: event.change.commitMessage,
                    change: {
                        oldrev: event.patchSet.parents[0],
                        newrev: event.newRev,
                        refname: event.refName
                    }
                };
                await revision.setMerged(ref);
                await this.emit("revision.merged", revision);
                log.info(`Gerrit event merged revision ${changeId}`);
            }
        }
    }

    async _startMonitorEventStream() {
        const { stdout, stderr } = await this._execGerritCommand("stream-events");

        this.gerritEmitter.addListener("stderr-output", (line) => {
            log.error("Gerrit event stream stderr: ", line);
        });
        this.gerritEmitter.addListener("patchset-created", this._onPatchsetCreated.bind(this));
        this.gerritEmitter.addListener("change-merged", this._onChangeMerged.bind(this));

        await this.gerritEmitter.start(stdout, stderr);
    }

    async create(repository) {
        log.info(`gerrit create repo ${repository._id}`);
        const { exitCode, errLines } = await this._execGerritCommandReadOutput(
            `create-project ${repository._id} ` +
            "--submit-type REBASE_IF_NECESSARY --empty-commit"
        );

        if (exitCode !== 0) {
            if (errLines[0].match(/Project already exists/)) {
                // OK, project already exists!
                log.info(`gerrit repo ${repository._id} already exists, attached to existing`);
            } else {
                throw new Error(`Gerrit command failed with exit code ${exitCode}. stderr=${errLines.join("\n")}`);
            }
        }
    }

    async merge(repository, revision) {
        log.info(`gerrit merge ${revision._id} in repo ${repository._id}`);
        // ssh -p 29418 $USER@localhost gerrit review `git rev-parse HEAD` --code-review '+2' --submit
        const ref = revision.patches[revision.patches.length - 1];
        const { exitCode, errLines } = await this._execGerritCommandReadOutput(
            `review ${ref.change.newrev} --submit`
        );

        if (exitCode !== 0) {
            const needsCodeReviewLines = errLines.filter((line) => line.match(/needs Code-Review/));
            if (needsCodeReviewLines.length > 0) {
                throw new Error(`Cannot merge, needs Code-Review: ${needsCodeReviewLines[0]}`);
            } else {
                throw new Error(`Gerrit command failed with exit code ${exitCode}. stderr=${errLines.join("\n")}`);
            }
        }

        let revisionMergedListener;
        const revisionMergedPromise = new Promise((resolve) => {
            revisionMergedListener = (resolve, mergedRev) => {
                if (mergedRev._id === revision._id) {
                    resolve(mergedRev);
                }
            };
            revisionMergedListener = revisionMergedListener.bind(this, resolve);
            this.on("revision.merged", revisionMergedListener);
        });
        await asyncWithTmo(
            revisionMergedPromise,
            DEFAULT_GERRIT_TIMEOUT,
            new Error(`Timeout while waiting for merge of revision ${revision._id} to complete`)
        );
        if (revisionMergedListener) {
            this.removeListener("revision.merged", revisionMergedListener);
        }

        return false;
    }

    async getUri(backend, repository) {
        const gerritUrl = url.parse(backend.uri);
        const connectUri = gerritUrl.format().replace(gerritUrl.auth, "$USER");

        return `${connectUri}/${repository._id}`;
    }

    async update(/* repository */) {
        // TODO: Implement update
    }

    async remove(/* repository */) {
        // TODO: Implement remove
    }

    async _getUserPublicKeys(username) {
        const restClient = await serviceMgr.use("userrepo");

        return await restClient.get(`/user/${username}/keys`);
    }


    async dispose() {
        this.removeAllListeners();
        this.gerritEmitter.removeAllListeners();
        await this.gerritEmitter.dispose();
        await this.__ssh.disconnect();
    }
}

module.exports = GerritBackend;
