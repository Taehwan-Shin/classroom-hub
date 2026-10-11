# GitHub Pages 배포

배포 주소: https://taehwan-shin.github.io/classroom-hub/

이 공개 저장소의 gh-pages 브랜치 루트에 검증한 build/static 파일과 .nojekyll만 배포한다. GitHub 기본 브랜치 배포를 사용하며 별도 외부 Actions, npm 패키지 또는 설치 스크립트를 도입하지 않는다. HTTPS를 강제한다. 일기 저장소와 실제 기록을 배포하지 않는다.

소스는 main 브랜치, 실제 정적 배포본은 gh-pages 브랜치다. main만 수정하면 사이트가 자동 갱신되는 구조가 아니다. 이후 릴리스는 Node.js 최신 보안 패치에서 node --test tests/*.test.mjs와 node scripts/build-static.mjs를 실행하고, BUILD-MANIFEST.json의 파일 목록·해시·개인 파일 제외를 검토한 뒤 정적 파일만 gh-pages에 갱신한다. 기존 배포 이력은 보존하며 강제 푸시하지 않는다.

## Pages 보안 정책과 한계

HTML의 CSP는 외부 연결(connect-src 'none'), 인라인 스크립트·eval, 외부 스크립트·스타일, 플러그인과 폼 전송을 차단한다. 리퍼러는 meta referrer=no-referrer로 제한한다. 경로는 상대 주소와 해시 라우팅을 사용하므로 /classroom-hub/ 하위에서도 동작한다. 문서와 합성 검사 결과는 서버에 업로드하지 않는다. 일반 접속·정적 파일 요청의 호스팅 로그는 GitHub가 처리한다.

GitHub Pages에 build/security-headers.json이 자동 적용되는 것은 아니다. 사용자 지정 Content-Security-Policy, X-Frame-Options, Permissions-Policy, Cache-Control 응답 헤더를 이 배포에서 설정하지 못한다. frame-ancestors는 HTML meta로 대체할 수 없으므로 HTTP 헤더 기반 iframe 차단을 보장하지 않는다. OCR worker에도 지정한 worker CSP 헤더를 강제하지 못하며 기존 코드의 외부 리소스 거부·로컬 모델·logging:false를 유지한다. 로컬 미리보기 서버의 헤더 검증 결과를 Pages에 적용됐다고 간주하지 않는다.

원래 README의 사용자 지정 응답 헤더를 모두 지원하는 호스팅 요건에 대해, 사용자가 명시적으로 GitHub Pages 배포를 요청하여 이 차이를 기록하고 지원되는 정적 정책으로 배포했다. 응답 헤더 전체 적용이 필요한 환경에서는 해당 기능을 지원하는 호스팅을 사용한다. 일기·계정·비밀번호·서버 저장 기능을 Pages에 추가하지 않는다.

## 검증

공개 소스 테스트, vendor 고정 해시, 정적 파일 허용 목록과 릴리스 manifest를 검사한다. 배포 후 HTTPS 응답·JavaScript MIME·하위 경로·세 도구 화면·합성 PDF/OCR·다운로드·외부 연결·일기 경로 제외를 검증한다. 실제 학생·교사 문서와 개인정보는 테스트에 사용하지 않는다. 최초 배포 검증 결과는 SECURITY-AUDIT.md에 기록한다.

2026-10-12 최초 배포 검증 완료: 소스 테스트 34개, 실사이트 허브·타이머 48개, PDF/OCR 25개 통과. 게임의 시작·문제·해설·계속 진행·일시정지를 확인했다. 배포 파일 36개의 해시와 JavaScript MIME이 일치했다. 실제 HTTP 응답에는 HSTS가 있고 CSP·X-Frame-Options·X-Content-Type-Options 헤더는 없다. 위에 설명한 meta 정책과 헤더 한계가 실제 환경에도 해당한다.
