import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
// 버전 비교를 위해 semver 라이브러리를 import 합니다.
import * as semver from 'semver';

// execute 함수에서 사용할 파라미터 타입을 정의합니다.
// (단일 입력이므로 interface가 더 이상 필요 없습니다.)

export class NpmWatch implements INodeType {
    
    // --- 1. 노드 UI 정의 (단일 입력으로 수정) ---
    description: INodeTypeDescription = {
        displayName: 'NPM Package Watch', // V2 제거
        name: 'npmWatch',                 // V2 제거
        icon: 'fa:npm',
        group: ['transform'],
        version: 1,
        description: 'Monitors a single NPM package for updates.', // "multiple" -> "a single"
        defaults: {
            name: 'NPM Watch',
        },
        inputs: ['main'],
        outputs: ['main'],
        
        // ✨ 수정된 부분: 'fixedCollection' 대신 'string' 타입의 단일 속성으로 변경
        properties: [
            {
                displayName: 'Package Name',
                name: 'packageName',
                type: 'string',
                default: '',
                placeholder: 'e.g. n8n-nodes-firecrawl-scraper',
                description: 'The name of the NPM package to monitor',
                required: true, // 단일 입력이므로 필수 항목으로 지정
            },
        ],
    };

    // --- 2. 노드 실행 로직 (단일 입력으로 수정) ---
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        // (바깥 루프) 노드로 들어오는 아이템 수만큼 반복
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            
            try {
                // ✨ 수정된 부분: 'packages' 목록 대신 'packageName' 문자열을 직접 가져옵니다.
                const packageName = this.getNodeParameter(
                    'packageName',
                    itemIndex,
                    '',
                ) as string;

                // 패키지 이름이 비어있으면 에러 발생
                if (!packageName) {
                    throw new Error('Package Name is required.');
                }
                
                // (안쪽 루프가 제거되었습니다)

                // n8n 내장 HTTP Request 헬퍼로 npm 레지스트리 요청
                const data = (await this.helpers.httpRequest.call(this, {
                    method: 'GET',
                    url: `https://registry.npmjs.org/${packageName}`,
                    json: true,
                })) as any;

                // 'dist-tags'에서 최신 버전 태그 가져오기
                const latestVersion = data['dist-tags']?.latest;
                if (!latestVersion) {
                    throw new Error(
                        `Could not find 'latest' tag for package: ${packageName}`,
                    );
                }

                // 모든 버전 키를 배열로 만들기
                const allVersions = Object.keys(data.versions);
                if (allVersions.length === 0) {
                    throw new Error(`No versions found for package: ${packageName}`);
                }

                // semver로 버전 정렬
                const sortedVersions = allVersions.sort(semver.compare);

                // 최신 버전과 직전 버전 찾기
                const latestIndex = sortedVersions.indexOf(latestVersion);
                const previousVersion =
                    latestIndex > 0 ? sortedVersions[latestIndex - 1] : null;

                // 최신 버전 상세 데이터 가져오기
                const latestVersionData = data.versions[latestVersion];

                // GitHub URL 추출 로직
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

                // npm 패키지 URL 생성
                const npmUrl = `https://www.npmjs.com/package/${packageName}`;

                // 최종 결과 데이터 구성
                const result = {
                    packageName: packageName,
                    latestVersion: latestVersion,
                    previousVersion: previousVersion,
                    npmUrl: npmUrl,
                    githubUrl: githubUrl || 'Not found',
                };

                // 각 아이템별로 결과(json)를 생성하여 returnData에 추가
                returnData.push({ json: result, pairedItem: { item: itemIndex } });

            } catch (error) {
                // 에러가 발생해도 워크플로우가 멈추지 않도록 처리
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                        pairedItem: { item: itemIndex },
                    });
                } else {
                    // 'Continue on Fail'이 꺼져있으면 에러 발생
                    throw error;
                }
            }
        } // --- 바깥 루프(입력 아이템) 종료 ---

        // 최종 데이터를 다음 노드로 반환합니다.
        return this.prepareOutputData(returnData);
    }
}