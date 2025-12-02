"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NpmWatch = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const semver_1 = require("semver");
class NpmWatch {
    constructor() {
        this.description = {
            displayName: 'NPM Package Watch',
            name: 'npmWatch',
            icon: {
                light: 'file:../../icons/npmwatch.svg',
                dark: 'file:../../icons/npmwatch.dark.svg',
            },
            group: ['transform'],
            version: 1,
            description: 'Monitors multiple NPM packages for updates and returns the change type (major, minor, patch).',
            defaults: {
                name: 'NPM Watcher',
            },
            usableAsTool: true,
            inputs: ['main'],
            outputs: ['main'],
            properties: [
                {
                    displayName: 'Packages',
                    name: 'packages',
                    type: 'fixedCollection',
                    typeOptions: {
                        multipleValues: true,
                    },
                    placeholder: 'Add Package',
                    default: {},
                    options: [
                        {
                            name: 'packageEntry',
                            displayName: 'Package Entry',
                            values: [
                                {
                                    displayName: 'Package Name',
                                    name: 'packageName',
                                    type: 'string',
                                    default: '',
                                    placeholder: 'e.g. n8n',
                                    required: true,
                                },
                                {
                                    displayName: 'Known Version',
                                    name: 'knownVersion',
                                    type: 'string',
                                    default: '',
                                    placeholder: 'e.g. 1.1.0',
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const collectionData = this.getNodeParameter('packages', itemIndex, { packageEntry: [] });
                const packageList = collectionData.packageEntry;
                if (packageList.length === 0) {
                    continue;
                }
                for (const pkg of packageList) {
                    const packageName = pkg.packageName;
                    const knownVersion = pkg.knownVersion || '';
                    if (!packageName) {
                        continue;
                    }
                    const data = (await this.helpers.httpRequest.call(this, {
                        method: 'GET',
                        url: `https://registry.npmjs.org/${packageName}`,
                        json: true,
                    }));
                    const distTags = data['dist-tags'];
                    const latestVersion = distTags === null || distTags === void 0 ? void 0 : distTags.latest;
                    if (!latestVersion) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Could not find 'latest' tag for package: ${packageName}`, { itemIndex });
                    }
                    const timeData = data.time;
                    let hasChanged = false;
                    let changeType = null;
                    if (knownVersion && (0, semver_1.valid)(knownVersion)) {
                        if (latestVersion !== knownVersion) {
                            hasChanged = true;
                            changeType = (0, semver_1.diff)(knownVersion, latestVersion);
                        }
                    }
                    else if (knownVersion) {
                        if (latestVersion !== knownVersion) {
                            hasChanged = true;
                            changeType = 'unknown';
                        }
                    }
                    const versionsData = data.versions;
                    const allVersions = Object.keys(versionsData);
                    const sortedVersions = allVersions.sort(semver_1.compare);
                    const latestIndex = sortedVersions.indexOf(latestVersion);
                    const previousVersion = latestIndex > 0 ? sortedVersions[latestIndex - 1] : null;
                    const latestPublishedAt = timeData && timeData[latestVersion] ? timeData[latestVersion] : null;
                    const previousPublishedAt = previousVersion && timeData && timeData[previousVersion]
                        ? timeData[previousVersion]
                        : null;
                    const latestVersionData = versionsData[latestVersion];
                    let githubUrl = '';
                    if (latestVersionData.homepage) {
                        githubUrl = latestVersionData.homepage;
                    }
                    else if (latestVersionData.repository) {
                        const repository = latestVersionData.repository;
                        if (repository.url) {
                            githubUrl = repository.url;
                            githubUrl = githubUrl.replace(/^git\+/, '').replace(/\.git$/, '');
                        }
                    }
                    if (githubUrl.includes('#')) {
                        githubUrl = githubUrl.split('#')[0];
                    }
                    const npmUrl = `https://www.npmjs.com/package/${packageName}`;
                    const result = {
                        packageName,
                        latestVersion,
                        latestPublishedAt,
                        knownVersion: knownVersion || null,
                        hasChanged,
                        changeType,
                        previousVersion,
                        previousPublishedAt,
                        npmUrl,
                        githubUrl: githubUrl || 'Not found',
                    };
                    returnData.push({ json: result, pairedItem: { item: itemIndex } });
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                        },
                        pairedItem: { item: itemIndex },
                    });
                }
                else {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, {
                        itemIndex,
                    });
                }
            }
        }
        return this.prepareOutputData(returnData);
    }
}
exports.NpmWatch = NpmWatch;
//# sourceMappingURL=NpmWatch.node.js.map