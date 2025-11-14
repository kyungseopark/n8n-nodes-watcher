import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
// Import 'compare', 'diff', and 'valid' functions from semver
import { compare, diff, valid } from 'semver';

// Interface for the data structure returned by 'fixedCollection'
interface IPackageCollection {
    packageEntry: {
        packageName: string;
        knownVersion?: string;
    }[];
}

export class NpmWatch implements INodeType {
    
    description: INodeTypeDescription = {
        displayName: 'NPM Package Watch',
        name: 'npmWatch',
        icon: { light: 'file:../../icons/npmwatch.svg', dark: 'file:../../icons/npmwatch.dark.svg' },
        group: ['transform'],
        version: 1,
        description: 'Monitors multiple NPM packages for updates and returns the change type (major, minor, patch).',
        defaults: {
            name: 'NPM Watcher',
        },
        inputs: ['main'],
        outputs: ['main'],
        
        properties: [
            {
                displayName: 'Packages',
                name: 'packages',
                type: 'fixedCollection', // Use 'fixedCollection' instead of 'collection'
                typeOptions: {
                    multipleValues: true, // This option allows adding multiple "sets"
                },
                placeholder: 'Add Package',
                default: {}, // Default value is an empty object
                options: [
                    // 'options' defines the structure of each set
                    {
                        name: 'packageEntry', // Internal name of the set
                        displayName: 'Package Entry',
                        values: [
                            // Define the fields that will be in the "set" inside 'values'
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

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        // (Outer loop) Executes for each item coming into the workflow
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            
            // Get the 'packages' collection from the UI
            // Data is in the format { packageEntry: [ ... ] }
            const collectionData = this.getNodeParameter(
                'packages',
                itemIndex,
                { packageEntry: [] }, // default value
            ) as IPackageCollection;

            // Array of the actual package "set" list
            const packageList = collectionData.packageEntry;

            if (packageList.length === 0) {
                continue;
            }

            // (Inner loop) Executes for each item (pkg) in the 'packageList'
            for (const pkg of packageList) {
                try {
                    const packageName = pkg.packageName;
                    const knownVersion = pkg.knownVersion || ''; // If no value, use an empty string

                    if (!packageName) {
                        continue; 
                    }
                    
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

                    // Get the 'time' object which contains publish timestamp info
                    const timeData = data.time as Record<string, string> | undefined;

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
                    
                    const allVersions = Object.keys(data.versions);
                    const sortedVersions = allVersions.sort(compare);
                    const latestIndex = sortedVersions.indexOf(latestVersion);
                    const previousVersion =
                        latestIndex > 0 ? sortedVersions[latestIndex - 1] : null;

                    // Look up timestamps from the 'time' object
                    const latestPublishedAt = timeData && timeData[latestVersion] ? timeData[latestVersion] : null;
                    const previousPublishedAt = previousVersion && timeData && timeData[previousVersion] ? timeData[previousVersion] : null;

                    
                    const latestVersionData = data.versions[latestVersion];
                    let githubUrl = '';
                    if (latestVersionData.homepage) {
                        githubUrl = latestVersionData.homepage;
                    } else if (
                        latestVersionData.repository &&
                        latestVersionData.repository.url
                    ) {
                        githubUrl = latestVersionData.repository.url;
                        // Remove 'git+' prefix and '.git' suffix
                        githubUrl = githubUrl
                            .replace(/^git\+/, '')
                            .replace(/\.git$/, '');
                    }
                    // Remove anchors like '#readme' from the end of the URL
                    if (githubUrl.includes('#')) {
                        githubUrl = githubUrl.split('#')[0];
                    }

                    const npmUrl = `https://www.npmjs.com/package/${packageName}`;

                    const result = {
                        packageName: packageName,
                        latestVersion: latestVersion,
                        latestPublishedAt: latestPublishedAt, // Added publish time
                        knownVersion: knownVersion || null,
                        hasChanged: hasChanged,
                        changeType: changeType,
                        previousVersion: previousVersion,
                        previousPublishedAt: previousPublishedAt, // Added publish time
                        npmUrl: npmUrl,
                        githubUrl: githubUrl || 'Not found',
                    };
                    
                    // Add the result for each package to returnData
                    returnData.push({ json: result, pairedItem: { item: itemIndex } });

                } catch (error) {
                    // Handle errors so the workflow does not stop
                    if (this.continueOnFail()) {
                        returnData.push({
                            json: { 
                                error: error.message,
                                packageName: pkg.packageName, // Specify which package caused the error
                            },
                            pairedItem: { item: itemIndex },
                        });
                    } else {
                        throw error;
                    }
                }
            } 
        } 

        return this.prepareOutputData(returnData);
    }
}