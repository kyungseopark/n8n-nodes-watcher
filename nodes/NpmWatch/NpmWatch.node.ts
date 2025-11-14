import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
// Import 'compare', 'diff', and 'valid' functions from semver
import { compare, diff, valid } from 'semver';

export class NpmWatch implements INodeType {
    
    description: INodeTypeDescription = {
        displayName: 'NPM Package Watch',
        name: 'npmWatch',
        icon: { light: 'file:../../icons/npmwatch.svg', dark: 'file:../../icons/npmwatch.dark.svg' },
        group: ['transform'],
        version: 1,
        description: 'Monitors a single NPM package for updates and returns the change type (major, minor, patch).',
        defaults: {
            name: 'NPM Watcher',
        },
        inputs: ['main'],
        outputs: ['main'],
        
        properties: [
            {
                displayName: 'Package Name',
                name: 'packageName',
                type: 'string',
                default: '',
                placeholder: 'e.g. n8n-nodes-firecrawl-scraper',
                description: 'The name of the NPM package to monitor',
                required: true,
            },
            {
                displayName: 'Known Version',
                name: 'knownVersion',
                type: 'string',
                default: '',
                placeholder: 'e.g. 1.1.0 (Must be valid semver)',
                description: 'The version to check against. If the latest version is different, hasChanged will be true.',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            
            try {
                const packageName = this.getNodeParameter(
                    'packageName',
                    itemIndex,
                    '',
                ) as string;
                let knownVersion = this.getNodeParameter(
                    'knownVersion',
                    itemIndex,
                    '',
                ) as string;

                if (!packageName) {
                    throw new Error('Package Name is required.');
                }
                
                // --- (1. HTTP request and get version info) ---
                const data = (await this.helpers.httpRequest.call(this, {
                    method: 'GET',
                    url: `https://registry.npmjs.org/${packageName}`,
                    json: true,
                })) as any;

                const latestVersion = data['dist-tags']?.latest;
                if (!latestVersion) {
                    throw new Error(
                        `Could not find 'latest' tag for package: ${packageName}`,
                    );
                }

                // ✨ Get the 'time' object which contains publish timestamp info
                const timeData = data.time as Record<string, string> | undefined;

                // --- (2. "Change Detection" and "Type Analysis" Logic) ---
                let hasChanged = false;
                let changeType: string | null = null;
                
                if (knownVersion && valid(knownVersion)) {
                    if (latestVersion !== knownVersion) {
                        hasChanged = true;
                        changeType = diff(knownVersion, latestVersion);
                    }
                } else if (knownVersion) {
                    if (latestVersion !== knownVersion) {
                        hasChanged = true;
                        changeType = 'unknown';
                    }
                }
                
                // --- (3. Extract other info - find the previous version) ---
                const allVersions = Object.keys(data.versions);
                const sortedVersions = allVersions.sort(compare);
                const latestIndex = sortedVersions.indexOf(latestVersion);
                const previousVersion =
                    latestIndex > 0 ? sortedVersions[latestIndex - 1] : null;

                // ✨ Look up timestamps from the 'time' object
                const latestPublishedAt = timeData && timeData[latestVersion] ? timeData[latestVersion] : null;
                const previousPublishedAt = previousVersion && timeData && timeData[previousVersion] ? timeData[previousVersion] : null;

                
                // --- (4. Extract GitHub/NPM URLs) ---
                const latestVersionData = data.versions[latestVersion];
                let githubUrl = '';
                if (latestVersionData.homepage) {
                    githubUrl = latestVersionData.homepage;
                } else if (
                    latestVersionData.repository &&
                    latestVersionData.repository.url
                ) {
                    githubUrl = latestVersionData.repository.url;
                    githubUrl = githubUrl
                        .replace(/^git\+/, '')
                        .replace(/\.git$/, '');
                }
                if (githubUrl.includes('#')) {
                    githubUrl = githubUrl.split('#')[0];
                }

                const npmUrl = `https://www.npmjs.com/package/${packageName}`;

                // --- (5. Return final result) ---
                const result = {
                    packageName: packageName,
                    latestVersion: latestVersion,
                    latestPublishedAt: latestPublishedAt, // ✨ Added publish time
                    knownVersion: knownVersion || null,
                    hasChanged: hasChanged,
                    changeType: changeType,
                    previousVersion: previousVersion,
                    previousPublishedAt: previousPublishedAt, // ✨ Added publish time
                    npmUrl: npmUrl,
                    githubUrl: githubUrl || 'Not found',
                };
                
                returnData.push({ json: result, pairedItem: { item: itemIndex } });

            } catch (error) {
                // Handle errors so the workflow does not stop
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                        pairedItem: { item: itemIndex },
                    });
                } else {
                    throw error;
                }
            }
        } 

        return this.prepareOutputData(returnData);
    }
}