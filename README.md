

## n8n-nodes-watch

This is an n8n community node. It lets you watch one or more npm packages for new releases directly from your n8n workflows.

**npm Watch** queries the public npm registry for a given package, compares the latest published version with a “known version” you provide, and returns whether there was a **major / minor / patch** change, along with basic metadata (publish timestamps, npm / GitHub links, etc.).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

This package is licensed under the MIT License.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Once community nodes are enabled, install this package via:

```bash
npm install n8n-nodes-watch
```

Or use the **Community Nodes** section in the n8n UI and search for `npm-watch` / `npm package watch`.

## Operations

This node provides one main operation:

### NPM Package Watch

Monitor one or more npm packages and return version-change information.

For each incoming item, and for each configured package entry, the node:

1. Calls the npm registry: `https://registry.npmjs.org/<packageName>`
2. Reads the current `latest` version from the `dist-tags`.
3. Optionally compares it to the **Known Version** you provide.
4. Determines whether the change is:

   * `major`
   * `minor`
   * `patch`
   * or `unknown` (if the known version is not a valid semver)
5. Returns metadata such as:

   * `packageName`
   * `latestVersion`
   * `latestPublishedAt`
   * `knownVersion`
   * `hasChanged` (boolean)
   * `changeType` (major / minor / patch / unknown / null)
   * `previousVersion`
   * `previousPublishedAt`
   * `npmUrl`
   * `githubUrl` (or repository homepage URL)

### Node Parameters

* **Packages** (`packages`, fixedCollection, multiple)

  * **Package Entry**

    * **Package Name** (`packageName`, string, required)
      The name of the npm package (e.g. `n8n`, `react`, `lodash`).
    * **Known Version** (`knownVersion`, string, optional)
      The version you currently know or are using (e.g. `1.1.0`).
      If this is a valid semver string, the node will compute:

      * `major`, `minor`, or `patch` using the `semver` library.
        If it’s not valid semver but differs from the latest, `changeType` will be `unknown`.

These parameters match the node implementation:

* `packages` is a **fixedCollection**.
* The collection contains **packageEntry[]**.
* Each `packageEntry` has `packageName` (required) and `knownVersion` (optional).

## Credentials

No credentials are required.

This node uses the public npm registry (`https://registry.npmjs.org`) via n8n’s built-in HTTP helper `this.helpers.httpRequest`. As long as your n8n instance has outbound internet access, the node will work.

## Compatibility

* **n8n version**: 
  * n8n Nodes API version: 1
  * Node version (nodeVersion): 1.0
  * Codex version: 1.0
  * Categories (in n8n UI): Utility, Development

Runtime compatibility:
  * n8n version: Developed and tested against n8n v1.x and should work with recent 1.x versions.
  * Node.js: Intended for Node.js >= 18 (aligned with n8n 1.x).

* **Implementation details**:

  * Uses `fixedCollection` for multiple package entries.
  * Uses `this.helpers.httpRequest` to call the npm registry:

    * `GET https://registry.npmjs.org/${packageName}`
  * Uses `semver.compare`, `semver.diff`, and `semver.valid` to handle version comparison and change-type detection.

If you run into any issues on specific n8n versions, please open an issue on the repository so version compatibility can be documented more precisely.

## Usage

### Basic usage

1. Add a trigger, for example:

   * A **Cron** node to run once a day (e.g. every morning).

2. Add the **NPM Package Watch** node.

3. In **Packages → Add Package**, configure one or more **Package Entry** items:

   Example:

   * Package Entry 1

     * Package Name: `n8n`
     * Known Version: `1.50.0`
   * Package Entry 2

     * Package Name: `semver`
     * Known Version: `7.5.0`

4. Connect the node’s output to any notification or logging node:

   * Email, Slack, Telegram, Discord, Webhook, Data store, etc.

Each incoming item × package entry produces **one output item**.
If you have 1 incoming item and 3 package entries, you’ll get 3 result items.

### Example output

A single result item looks like:

```json
{
  "packageName": "n8n",
  "latestVersion": "1.62.1",
  "latestPublishedAt": "2025-01-10T12:34:56.000Z",
  "knownVersion": "1.60.0",
  "hasChanged": true,
  "changeType": "minor",
  "previousVersion": "1.61.0",
  "previousPublishedAt": "2025-01-03T09:21:00.000Z",
  "npmUrl": "https://www.npmjs.com/package/n8n",
  "githubUrl": "https://github.com/n8n-io/n8n"
}
```

You can then:

* Filter by `hasChanged = true` to only notify when there is a new version.
* Branch on `changeType`:

  * `major` → create a task for engineers to review breaking changes.
  * `minor` / `patch` → send a short notification or log the update.

### Error handling

The node respects n8n’s **Continue On Fail** setting.

If the npm registry request fails for a given package (e.g. package not found, network error):

* With **Continue On Fail = true**, the node returns an item like:

  ```json
  {
    "error": "Could not find 'latest' tag for package: some-unknown-package",
    "packageName": "some-unknown-package"
  }
  ```

* With **Continue On Fail = false**, the error is thrown and the workflow execution stops.

This matches the implementation:

* Errors are caught inside the inner `try { ... } catch (error) { ... }` block.
* When `this.continueOnFail()` is true, an item with `error` and `packageName` is pushed to `returnData`.
* Otherwise, the error is re-thrown.

### Tips

* Store your current production versions in a database or as incoming item data and feed them into this node, so it always compares against what you’re actually running.
* Use this node together with:

  * GitHub node: automatically create issues when a new version is released.
  * Jira / other task manager nodes: open upgrade tasks by change type.
  * Slack / Discord nodes: notify a specific channel about package updates.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [npm registry API documentation](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md)
* [npm website](https://www.npmjs.com/)
* [semver documentation](https://github.com/npm/node-semver)

## Version history

* **0.1.0**

  * Initial public release of n8n-nodes-watcher.
  * Node version: 1.0, Codex version: 1.0.
  * Supports multiple packages via `fixedCollection` (`packageEntry[]`).
  * Uses npm registry `dist-tags.latest` and the full version list to determine:

    * latest version
    * previous version
    * publish timestamps for both.
  * Computes `major` / `minor` / `patch` change type via `semver.diff`, with `unknown` for non-semver known versions.
  * Extracts `githubUrl` from `homepage` or `repository.url`, removing `git+` prefix, `.git` suffix, and anchors like `#readme`.
  * Error handling integrated with **Continue On Fail**, returning structured error items when enabled.

---

## 🇰🇷 Korean version (README.ko)

# n8n-nodes-npm-watch

이 레포는 n8n 커뮤니티 노드입니다. 이 노드를 사용하면 n8n 워크플로우 안에서 여러 개의 npm 패키지를 한 번에 모니터링하고 새 버전이 나왔는지 확인하며 알림 받을 수 있습니다.

**npm Watch** 노드는 공개 npm 레지스트리에서 패키지 정보를 불러와 사용자가 입력한 “기존 버전(known version)”과 최신 버전을 비교하고 그 차이가 **major / minor / patch** 중 어떤 유형인지 알려줍니다. 또한 최신 / 직전 버전의 배포 시간, npm / GitHub URL 등의 메타데이터도 함께 반환합니다.

[n8n](https://n8n.io/)은 [fair-code 라이선스](https://docs.n8n.io/reference/license/) 기반의 워크플로우 자동화 플랫폼입니다.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

n8n 커뮤니티 노드 설치 방법은 공식 문서를 참고하세요:
[Community nodes 설치 가이드](https://docs.n8n.io/integrations/community-nodes/installation/)

커뮤니티 노드를 활성화한 뒤, 다음과 같이 패키지를 설치할 수 있습니다:

```bash
npm install n8n-nodes-watch
```

또는 n8n UI의 **Community Nodes** 메뉴에서 `npm-watch` / `npm package watch` 등을 검색하여 설치할 수 있습니다.

## Operations

이 노드는 다음의 핵심 기능을 제공합니다

### NPM Package Watch

여러 개의 npm 패키지를 한 번에 확인하고, 버전 변화 정보를 반환합니다.

각 입력 아이템과 각 패키지 엔트리마다 노드는 다음 작업을 수행합니다.

1. `https://registry.npmjs.org/<packageName>` 엔드포인트로 npm 레지스트리를 호출합니다.
2. `dist-tags`의 `latest` 태그에서 최신 버전을 읽습니다.
3. 사용자가 입력한 **Known Version**이 있을 경우, 최신 버전과 비교합니다.
4. 두 버전의 차이가 다음 중 무엇인지 판단합니다.

   * `major`
   * `minor`
   * `patch`
   * `unknown` (known version이 유효한 semver 형식이 아닐 때)
5. 다음과 같은 메타데이터를 반환합니다.

   * `packageName`
   * `latestVersion`
   * `latestPublishedAt`
   * `knownVersion`
   * `hasChanged` (boolean)
   * `changeType` (major / minor / patch / unknown / null)
   * `previousVersion`
   * `previousPublishedAt`
   * `npmUrl`
   * `githubUrl` (또는 repository / homepage URL)

### Node Parameters

* **Packages** (`packages`, fixedCollection, multiple)

  * **Package Entry**

    * **Package Name** (`packageName`, string, 필수)
      npm 패키지 이름입니다. (예: `n8n`, `react`, `lodash`)
    * **Known Version** (`knownVersion`, string, 선택)
      현재 프로젝트에서 사용 중인 버전, 또는 기준으로 삼고 싶은 버전입니다. (예: `1.1.0`)

      * 이 값이 유효한 semver 문자열이라면 `semver` 라이브러리를 사용해
        `major`, `minor`, `patch` 중 어떤 변화인지 계산합니다.
      * 형식은 semver가 아니지만 latest와 값이 다를 경우, `changeType`은 `unknown`이 됩니다.


* `packages`는 **fixedCollection** 타입.
* 안에는 `packageEntry[]` 배열이 들어 있고,
* 각 `packageEntry`에 `packageName`(필수), `knownVersion`(선택)이 있습니다.

## Credentials

이 노드는 별도의 인증 정보가 필요 없습니다.

내부적으로 n8n의 `this.helpers.httpRequest`를 사용해 `https://registry.npmjs.org`에 요청을 보내며, n8n 인스턴스가 인터넷으로 나갈 수만 있으면 정상 동작합니다.

## Compatibility

* **지원 n8n 버전**: n8n v1.0 버전에서 개발 및 테스트되었으며, 대부분의 최신 1.0 버전에서 동작합니다.
* **구현 세부사항**:

  * 여러 패키지 입력을 위해 `fixedCollection`을 사용합니다.
  * npm 레지스트리 호출에 `this.helpers.httpRequest`를 사용합니다:

    * `GET https://registry.npmjs.org/${packageName}`
  * 버전 비교를 위해 `semver.compare`, `semver.diff`, `semver.valid`를 사용합니다.

특정 n8n 버전에서 문제가 발생한다면 레포지토리에 이슈를 남겨 주세요! 호환성 정보를 업데이트하는 데 도움이 됩니다.

## Usage

### 기본 사용법

1. 먼저 트리거 노드를 추가합니다. 예:

   * 매일 아침 실행되는 **Cron** 노드.

2. 그다음 **NPM Package Watch** 노드를 추가합니다.

3. **Packages → Add Package**에서 하나 이상의 **Package Entry**를 설정합니다.

   예시:

   * Package Entry 1

     * Package Name: `n8n`
     * Known Version: `1.50.0`
   * Package Entry 2

     * Package Name: `semver`
     * Known Version: `7.5.0`

4. NPM Watch 노드의 출력을 다음과 같은 노드에 연결해 알림/로그를 남길 수 있습니다.

   * Email, Slack, Telegram, Discord, Webhook, Data store 등

입력 아이템 수 × 패키지 엔트리 수만큼 출력 아이템이 생성됩니다.
예를 들어, 입력 아이템이 1개이고 Package Entry가 3개라면, 출력 아이템은 3개가 됩니다.

### 출력 예시

단일 결과 아이템은 다음과 비슷한 형태입니다.

```json
{
  "packageName": "n8n",
  "latestVersion": "1.62.1",
  "latestPublishedAt": "2025-01-10T12:34:56.000Z",
  "knownVersion": "1.60.0",
  "hasChanged": true,
  "changeType": "minor",
  "previousVersion": "1.61.0",
  "previousPublishedAt": "2025-01-03T09:21:00.000Z",
  "npmUrl": "https://www.npmjs.com/package/n8n",
  "githubUrl": "https://github.com/n8n-io/n8n"
}
```

이 출력 데이터를 활용해:

* `hasChanged = true` 인 경우에만 알림을 보내거나,
* `changeType`별로 분기하여

  * `major` → 브레이킹 체인지 검토용 이슈/티켓 생성
  * `minor` / `patch` → 간단 알림 전송 또는 로그 기록

같은 식으로 사용할 수 있습니다.

### 에러 처리

이 노드는 n8n의 **Continue On Fail** 설정을 따릅니다.

특정 패키지에 대해 npm 레지스트리 요청이 실패했을 경우(패키지 없음, 네트워크 오류 등):

* **Continue On Fail = true**일 때는 다음과 같은 아이템을 반환합니다.

  ```json
  {
    "error": "Could not find 'latest' tag for package: some-unknown-package",
    "packageName": "some-unknown-package"
  }
  ```

* **Continue On Fail = false**일 때는 에러를 그대로 throw하여 워크플로우 실행이 중단됩니다.

이는 실제 코드 구현의 해당 부분에서 확인 할 수 있습니다.

* `try { ... } catch (error) { ... }` 블록 내부에서 에러를 잡고,
* `this.continueOnFail()`이 true일 때는 `error`와 `packageName`을 가진 JSON을 `returnData`에 push,
* 아니면 에러를 다시 throw합니다.

### 활용 팁

* 실제 서비스에서 사용 중인 패키지 버전을 DB나 다른 노드에서 불러와 이 노드에 넘겨주면, “실제 운영 버전” 기준으로 업데이트 여부를 판별할 수 있습니다.
* 다음과 같은 노드와 함께 사용하기 좋습니다.

  * GitHub 노드: 새 버전이 나오면 자동으로 이슈 생성
  * Jira / 기타 이슈 트래커: `changeType`별로 업그레이드 태스크 생성
  * Slack / Discord 노드: 패키지 업데이트 상황을 특정 채널에 브로드캐스트

## Resources

* [n8n community nodes 문서](https://docs.n8n.io/integrations/#community-nodes)
* [npm registry API 문서](https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md)
* [npm 웹사이트](https://www.npmjs.com/)
* [semver 문서](https://github.com/npm/node-semver)

## Version history

* **1.0.0**

  * 초기 릴리스.
  * `fixedCollection`을 사용해 여러 패키지 입력(`packageEntry[]`) 지원.
  * npm 레지스트리의 `dist-tags.latest`와 전체 버전 리스트를 사용해

    * 최신 버전
    * 직전 버전
    * 두 버전의 배포 시각
    을 계산.
  * `semver.diff`를 이용해 `major` / `minor` / `patch` 타입 판별, semver가 아닌 knownVersion에 대해서는 `unknown` 처리.
  * `homepage` 또는 `repository.url`에서 `githubUrl`을 최대한 추출하고, `git+` 프리픽스와 `.git` 서픽스, `#readme` 같은 앵커를 제거.
  * **Continue On Fail** 옵션에 맞춘 에러 처리 로직 포함.
