import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
// Import 'compare', 'diff', and 'valid' functions from semver
import { compare, diff, valid } from 'semver';

// 'fixedCollection'이 반환하는 데이터 구조에 대한 인터페이스
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
        
        // --- 1. 'properties'를 'fixedCollection' 타입으로 수정 ---
        properties: [
            {
                displayName: 'Packages',
                name: 'packages',
                type: 'fixedCollection', // 'collection'이 아닌 'fixedCollection' 사용
                typeOptions: {
                    multipleValues: true, // 이 옵션으로 여러 "세트"를 추가할 수 있음
                },
                placeholder: 'Add Package',
                default: {}, // 기본값은 빈 객체
                options: [
                    // 'options'는 각 세트의 구조를 정의
                    {
                        name: 'packageEntry', // 세트의 내부 이름
                        displayName: 'Package Entry',
                        values: [
                            // 'values' 안에 "세트"가 될 필드들을 정의
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

    // --- 2. 'execute' 함수를 'fixedCollection' 구조에 맞게 수정 ---
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        // (바깥 루프) 워크플로우에 들어오는 각 아이템별로 실행
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            
            // UI에서 'packages' 컬렉션을 가져옵니다.
            // 데이터는 { packageEntry: [ ... ] } 형태입니다.
            const collectionData = this.getNodeParameter(
                'packages',
                itemIndex,
                { packageEntry: [] }, // 기본값
            ) as IPackageCollection;

            // 실제 패키지 "세트" 목록 배열
            const packageList = collectionData.packageEntry;

            if (packageList.length === 0) {
                continue;
            }

            // (안쪽 루프) 'packageList'의 각 항목(pkg)별로 실행
            for (const pkg of packageList) {
                try {
                    const packageName = pkg.packageName;
                    const knownVersion = pkg.knownVersion || ''; // 값이 없으면 빈 문자열

                    if (!packageName) {
                        continue; 
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
                        latestPublishedAt: latestPublishedAt,
                        knownVersion: knownVersion || null,
                        hasChanged: hasChanged,
                        changeType: changeType,
                        previousVersion: previousVersion,
                        previousPublishedAt: previousPublishedAt,
                        npmUrl: npmUrl,
                        githubUrl: githubUrl || 'Not found',
                    };
                    
                    // 각 패키지별 결과를 returnData에 추가
                    returnData.push({ json: result, pairedItem: { item: itemIndex } });

                } catch (error) {
                    // Handle errors so the workflow does not stop
                    if (this.continueOnFail()) {
                        returnData.push({
                            json: { 
                                error: error.message,
                                packageName: pkg.packageName, // 어떤 패키지에서 에러가 났는지 명시
                            },
                            pairedItem: { item: itemIndex },
                        });
                    } else {
                        throw error;
                    }
                }
            } // --- 안쪽 루프(pkg) 종료 ---
        } // --- 바깥 루프(itemIndex) 종료 ---

        return this.prepareOutputData(returnData);
    }
}