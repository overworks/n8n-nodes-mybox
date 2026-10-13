# @overworks/n8n-nodes-mybox

NAVER MYBOX Open API를 사용하는 n8n 커뮤니티 노드입니다. 공식 문서의 20개 API 엔드포인트와 n8n binary 파일 전송을 구현했습니다.

현재 개발판이며 npm에 배포되지 않았습니다. 실제 계정 테스트 후 GitHub 저장소를 공개하고 npm에 등록할 예정입니다. n8n 커뮤니티 노드 검증 신청은 첫 배포 이후 진행합니다.

## 구현된 기능

- **NAVER MYBOX API Credential**: 개인 액세스 토큰(PAT) 인증 및 연결 테스트
- **Storage → Get**: 전체·사용 용량, 파일 종류별 개수, 업로드 가능한 파일 최대 크기, 휴지통 자동 삭제 주기 조회
- **File or Folder → Get / Get Many**: 속성 조회, 루트 및 특정 폴더의 목록 조회
- **File / Folder → Search**: 검색어·종류·날짜·폴더 경로 검색
- **File → Upload / Download**: n8n binary 데이터 업로드 및 스트림 다운로드
- **File → Get Upload URL / Get Download URL**: 전송 URL 발급, 이어올리기용 URL·offset 발급
- **Folder → Create**: 루트 또는 특정 상위 폴더 아래에 폴더 생성
- **File or Folder → Copy / Move / Rename / Move to Trash / Favorite / Unfavorite**: 파일·폴더 관리
- **Trash → Get Many / Restore / Permanently Delete / Empty**: 휴지통 조회·복원·개별 영구 삭제·전체 비우기
- **Storage → Update**: 휴지통 자동 삭제 주기 설정(Off, 5, 15, 30, 50일)
- 목록과 검색의 커서 페이지네이션, Return All 및 Limit 지원
- 입력 아이템별 실행, 출력 아이템 연결, n8n의 오류 발생 시 계속 실행 설정 지원
- 조회 API의 429 응답은 `Retry-After`를 존중하여 최대 2회 재시도(헤더가 없으면 60초 대기). 60초를 초과하는 대기 요구는 오류로 반환합니다.

공식 문서의 20개 API 엔드포인트를 연결했습니다. 실제 계정에 대한 통합 테스트는 별도로 진행해야 합니다.

Upload는 입력 파일을 메모리에 읽고 multipart 요청을 구성합니다. 대용량 파일은 n8n의 가용 메모리를 고려해야 합니다. 이어올리기는 Get Upload URL에서 URL과 offset을 발급받는 범위까지 제공하며, 중단된 전송의 자동 재개는 지원하지 않습니다. 업로드 서버의 응답은 `uploadResponse`에 반환합니다.

변경 작업과 실제 파일 전송은 자동 재시도하지 않습니다. 업로드·다운로드 URL에는 PAT를 추가하지 않으며, 파일 전송 오류 메시지에는 URL의 인증 정보를 포함하지 않습니다.

## 인증

1. MYBOX 웹의 **설정 → 계정 및 개인 액세스 토큰 관리**에서 토큰을 생성합니다.
2. n8n에서 **NAVER MYBOX API** Credential을 생성합니다.
3. **Personal Access Token**에 토큰 원문을 입력합니다. `Bearer` 접두사는 노드가 추가합니다.
4. Credential을 저장하고 연결 테스트를 실행합니다. 연결 테스트는 `GET /v1/drive/storage`를 호출합니다.

토큰은 생성 시 한 번만 표시되며, 만료 전에 새 토큰으로 교체해야 합니다. 토큰은 n8n Credential에 저장합니다.

자세한 발급 방법과 제한은 [MYBOX Open API 시작하기](https://developers.mybox.naver.com/getting-started)를 참고하세요.

## 사용 시 참고 사항

- 파일·폴더 ID는 목록이나 검색 응답의 `resourceId`를 그대로 사용합니다.
- 목록 조회의 Folder ID, 폴더 생성·업로드·복사의 Parent Folder ID를 비우면 루트를 사용합니다. **Move는 목적지 폴더 ID가 필수**입니다.
- 파일명에는 확장자를 포함합니다. Upload의 File Name을 비우면 입력 binary 데이터의 파일명을 사용합니다. **Input Data Field Name**의 기본값은 `data`입니다.
- Download는 스트림을 n8n binary helper에 전달합니다. **Put Output File in Field**의 기본값은 `data`이며, 다른 입력 binary 필드는 유지합니다.
- 검색에는 검색어, 날짜 조건, 파일 종류 중 하나 이상이 필요합니다. 폴더는 Exact Path만으로 검색할 수 있으며, 이 값이 있으면 다른 검색 조건은 적용되지 않습니다.
- 복사·이동·업로드·복원의 Overwrite는 기본적으로 꺼져 있습니다.
- Move to Trash는 복원 가능한 삭제입니다. Trash의 Permanently Delete와 Empty는 영구 삭제이며, Empty는 계정의 휴지통 전체에 적용됩니다.
- 업로드 URL은 48시간 유효하고 업로드 후 재사용할 수 없습니다. 다운로드 URL은 10분간 유효한 일회용 URL입니다. URL 발급 작업의 출력에는 이 인증 URL이 포함됩니다. [업로드 API](https://developers.mybox.naver.com/docs/files_upload), [다운로드 API](https://developers.mybox.naver.com/docs/files_download)

## 개발 및 자동화 테스트

공식 `@n8n/node-cli`의 programmatic 템플릿 구성을 사용합니다.

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm pack
```

`npm test`는 TypeScript를 빌드하고 API 계약, 페이지네이션, binary 전송 구조, 입력란 표시·기본값, 오류·재시도·취소 처리를 검사합니다. 테스트의 HTTP 응답은 모의 데이터이며 실제 MYBOX 계정에 접근하지 않습니다. `npm pack`은 빌드 후 설치용 `.tgz`를 생성합니다.

개발 서버가 필요한 경우 `npm run dev`도 사용할 수 있습니다. [공식 개발 CLI 문서](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/)

## 기존 Docker n8n에서 테스트

npm 공개 없이 `.tgz` 파일을 기존 자체 호스팅 n8n에 설치할 수 있습니다. 다음은 공식 이미지, Compose 서비스 이름 `n8n`, 영구 데이터 경로 `/home/node/.n8n`을 사용하는 경우입니다. 패키지 파일을 서버의 Compose 프로젝트 폴더에 옮긴 뒤 실행합니다.

```sh
docker compose exec -u node n8n mkdir -p /home/node/.n8n/nodes

docker compose cp overworks-n8n-nodes-mybox-0.2.0.tgz \
  n8n:/home/node/.n8n/nodes/

docker compose exec -u node -w /home/node/.n8n/nodes n8n \
  npm install --omit=dev --ignore-scripts ./overworks-n8n-nodes-mybox-0.2.0.tgz

docker compose restart n8n
```

실제 서비스 이름과 데이터 경로에 맞게 명령을 조정하세요. `/home/node/.n8n`을 영구 볼륨으로 유지하면 패키지도 컨테이너 재생성 후 유지됩니다. Queue 모드에서는 실행을 담당하는 워커에서도 같은 패키지를 사용할 수 있어야 합니다. [n8n 수동 설치](https://docs.n8n.io/integrations/community-nodes/installation/manual-install/)

1. [저장공간 조회 예제](examples/storage-check.json)를 n8n에 가져옵니다.
2. NAVER MYBOX 노드에 자신의 PAT Credential을 연결합니다.
3. 수동 실행 후 `quotaBytes`, `usedBytes`, `fileCounts` 등의 출력을 확인합니다.
4. 목록·검색을 확인한 뒤 전용 테스트 폴더에서 작은 파일의 업로드·다운로드, 복사·이동·이름 변경, 휴지통 이동·복원을 확인합니다.

실제 PAT, 서비스 응답, 파일 전송 동작에 대한 통합 테스트는 아직 완료하지 않았습니다.

## 배포 계획

1. 비공개 저장소에서 기능 구현 및 자동화 테스트
2. 기존 자체 호스팅 n8n과 실제 MYBOX 계정으로 통합 테스트
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
