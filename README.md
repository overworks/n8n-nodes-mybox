# @overworks/n8n-nodes-mybox

NAVER MYBOX Open API를 사용하는 n8n 커뮤니티 노드입니다.

현재 초기 개발 단계이며 npm에 배포되지 않았습니다. 기능 구현과 실제 계정 테스트를 진행한 뒤 GitHub 저장소를 공개하고 npm에 등록할 예정입니다. n8n 커뮤니티 노드 검증 신청은 첫 배포 이후 진행합니다.

## 구현된 기능

- **NAVER MYBOX API Credential**: 개인 액세스 토큰(PAT) 인증 및 연결 테스트
- **Storage → Get**: 전체·사용 용량, 파일 종류별 개수, 업로드 가능한 파일 최대 크기, 휴지통 자동 삭제 주기 조회
- 입력 아이템별 실행, 출력 아이템 연결, n8n의 오류 발생 시 계속 실행 설정 지원

파일·폴더 조회와 검색, 폴더 생성, 업로드·다운로드, 파일 관리 및 휴지통 작업은 후속 구현 대상입니다.

## 인증

1. MYBOX 웹의 **설정 → 계정 및 개인 액세스 토큰 관리**에서 토큰을 생성합니다.
2. n8n에서 **NAVER MYBOX API** Credential을 생성합니다.
3. **Personal Access Token**에 토큰 원문을 입력합니다. `Bearer` 접두사는 노드가 추가합니다.
4. Credential을 저장하고 연결 테스트를 실행합니다. 연결 테스트는 `GET /v1/drive/storage`를 호출합니다.

토큰은 생성 시 한 번만 표시되며, 만료 전에 새 토큰으로 교체해야 합니다. 토큰은 n8n Credential에 저장합니다.

자세한 발급 방법과 제한은 [MYBOX Open API 시작하기](https://developers.mybox.naver.com/getting-started)를 참고하세요.

## 로컬 개발

공식 `@n8n/node-cli`의 programmatic 템플릿 구성을 사용합니다.

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm run dev
```

`npm run dev`는 개발용 n8n을 실행하고 노드 변경을 반영합니다. 개발 서버 요구 사항은 [n8n 공식 CLI 문서](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/)를 참고하세요.

n8n에서 **Manual Trigger → NAVER MYBOX** 워크플로를 만들고, Credential을 연결한 뒤 **Storage → Get**을 실행하면 저장공간 정보를 확인할 수 있습니다. 실제 MYBOX 계정으로 실행하려면 유효한 PAT가 필요합니다.

배포 파일 구성은 다음 명령으로 확인할 수 있습니다.

```sh
npm pack --dry-run
```

## 배포 계획

1. 비공개 저장소에서 기능 구현 및 로컬 테스트
2. 실제 MYBOX 계정으로 주요 기능 검증
3. GitHub 저장소 공개
4. `@overworks/n8n-nodes-mybox`를 공개 npm 패키지로 배포
5. n8n 커뮤니티 노드 검증 신청

패키지의 `publishConfig.access`는 `public`으로 설정되어 있습니다. 자동 배포 워크플로는 아직 구성하지 않았습니다.

## 참고 문서

- [MYBOX Open API](https://developers.mybox.naver.com/)
- [저장공간 조회 API](https://developers.mybox.naver.com/docs/dms_storage)
- [n8n 노드 개발](https://docs.n8n.io/integrations/creating-nodes/overview/)

## 라이선스

[MIT](LICENSE)
