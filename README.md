# jakeweb

DAY 번호순으로 웹사이트 링크와 짧은 설명을 보여주는 공개 목록입니다. 오른쪽 위 **New Web**에서 관리자 인증 후 새 링크를 등록합니다.

## Vercel 설정

1. GitHub의 `RE2031/jakeweb` 저장소를 Vercel에 가져옵니다.
2. Vercel Marketplace에서 Upstash Redis를 연결합니다. 프로젝트의 Production 환경에 `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN`이 설정되어 있는지 확인합니다.
3. Vercel의 프로젝트 Settings → Environment Variables에서 `ADMIN_PASSWORD`를 Sensitive 변수로 직접 설정하고 다시 배포합니다. 추측하기 어려운 긴 비밀번호를 사용하세요.
4. 공개 주소에서 **New Web**을 누르고 DAY 번호, 사이트 주소와 설명을 입력합니다.

비밀번호를 연속 3회 틀리면 해당 접속 IP의 로그인 시도가 Redis에서 영구 잠깁니다. 같은 IP를 공유하는 사람도 영향을 받습니다. 다른 IP에는 별도 카운터가 적용됩니다. 필요하면 Redis 콘솔에서 해당 `jakeweb:failures:*` 키를 삭제해 잠금을 해제할 수 있습니다. 로그인 세션은 15분 동안 유지됩니다. 비밀번호를 변경하면 기존 세션도 만료됩니다.

