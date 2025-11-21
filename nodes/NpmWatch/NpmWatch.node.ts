import {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { compare, diff, valid } from 'semver';

interface IPackageCollection {
	packageEntry: Array<{
		packageName: string;
		knownVersion?: string;
	}>;
}

export class NpmWatch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NPM Package Watch',
		name: 'npmWatch',
		icon: {
			light: 'file:../../icons/npmwatch.svg',
			dark: 'file:../../icons/npmwatch.dark.svg',
		},
		group: ['transform'],
		version: 1,
		description:
			'Monitors multiple NPM packages for updates and returns the change type (major, minor, patch).',
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const collectionData = this.getNodeParameter(
					'packages',
					itemIndex,
					{ packageEntry: [] },
				) as IPackageCollection;

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
					})) as IDataObject;

					const distTags = data['dist-tags'] as IDataObject;
					const latestVersion = distTags?.latest as string;

					if (!latestVersion) {
						throw new NodeOperationError(
							this.getNode(),
							`Could not find 'latest' tag for package: ${packageName}`,
							{ itemIndex },
						);
					}

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

					const versionsData = data.versions as IDataObject;
					const allVersions = Object.keys(versionsData);
					const sortedVersions = allVersions.sort(compare);
					const latestIndex = sortedVersions.indexOf(latestVersion);
					const previousVersion =
						latestIndex > 0 ? sortedVersions[latestIndex - 1] : null;

					const latestPublishedAt =
						timeData && timeData[latestVersion] ? timeData[latestVersion] : null;
					const previousPublishedAt =
						previousVersion && timeData && timeData[previousVersion]
							? timeData[previousVersion]
							: null;

					const latestVersionData = versionsData[latestVersion] as IDataObject;
					let githubUrl = '';

					if (latestVersionData.homepage) {
						githubUrl = latestVersionData.homepage as string;
					} else if (latestVersionData.repository) {
						const repository = latestVersionData.repository as IDataObject;
						if (repository.url) {
							githubUrl = repository.url as string;
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
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error.message,
						},
						pairedItem: { item: itemIndex },
					});
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}