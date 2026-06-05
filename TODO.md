# CommentGuard — 수동 작업 목록

> 직접 해야 하는 작업만 포함합니다. Claude Code가 처리할 수 있는 항목은 [CHECKLIST.md](CHECKLIST.md) § Phase 0에 있습니다.
> 완료 시 `[x]`로 표시하세요.

---

## Phase 0 — 환경 세팅

### 외부 계정 / API 키 발급

- [X] **YouTube Data API v3** — Google Cloud Console에서 활성화, API 키 발급
  - Quota 기본 10,000 units/day → 필요 시 증설 신청
  - `commentThreads.list` 권한 확인
  - 채널별 OAuth token → `.env`에 `YOUTUBE_OAUTH_TOKEN_<CREDENTIAL_REF>` 형태로 등록
- [X] **OpenAI API** — 계정 생성, `gpt-4o` 접근 가능한 플랜 확인, API 키 발급
- [X] **Google OAuth 2.0** — Google Cloud Console → OAuth 2.0 크레덴셜 생성
  - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
  - 운영 도메인 추가 예정

### .env 값 입력

- [X] `YOUTUBE_API_KEY` 입력
- [X] `OPENAI_API_KEY` 입력
- [X] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXTAUTH_SECRET` 입력

### Cloudflare R2 버킷 생성

- [X] Cloudflare 대시보드 → R2 → `commentguard-evidence` 버킷 생성
  - 경로 구조: `/snapshots`, `/evidence-pdf`
- [X] R2 API 토큰 발급 → `.env`에 `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT_URL` 입력

### 배포 연결

- [ ] **Vercel** — `apps/web` 프로젝트 연결, git push → 자동 배포 확인
- [ ] **Railway** — 프로젝트 생성, 각 서비스 환경변수 등록
  - 대상 서비스: `bff-api`, `collector-service`, `evidence-service`, `action-service`, `risk-classifier`

---

## KoBERT 모델 호스팅 결정 (Phase 2)

- [ ] 호스팅 환경 결정 (HuggingFace Hub / 자체 서버)
  - 결정 후 `.env`에 `KOBERT_URL=http://<host>/` 설정
  - 미설정 시 GPT-4o fallback 동작 중

---

## 법무 어드바이저 검토 (Phase 1 전)

- [ ] **위험 분류 키워드 / 기준 검토**
  - 파일: [services/risk-classifier/app/classifiers/rule_engine.py](services/risk-classifier/app/classifiers/rule_engine.py)
  - `LEGAL_THREAT_KEYWORDS`, `HATE_SPEECH_KEYWORDS` 등 법령 기준으로 검토 필요
- [ ] **Chain of Custody 형식 검증**
  - 파일: [services/evidence-service/src/pdf/generator.ts](services/evidence-service/src/pdf/generator.ts)
  - 실제 법정 제출 가능한 형식인지 법무 어드바이저 서명 필요
- [ ] **면책 조항 문구 검토** — PDF 하단 disclaimer 문구 최종 확인
- [ ] **PIPA 준수 법률 검토** — `AccountPattern`의 `authorPlatformId` 저장이 개인정보 처리에 해당하는지 확인

---

## GA 출시 전 (Phase 1 이후)

- [ ] **Phase 3**: AWS S3 버킷 생성 + Object Lock Compliance Mode 활성화 (30일 최소 보존) — R2는 Object Lock 미지원
- [ ] **Phase 3**: AWS KMS 키 생성 (AES-256) — Phase 1은 R2 서버사이드 암호화로 충분
- [ ] 외부 보안 업체 Penetration Test 완료 — CHECKLIST §10 GA gate
- [ ] MFA 강제 적용 확인 (모든 운영자 계정)

---

> 완료된 항목은 `[x]`로 체크하세요.
> 새로 발견된 작업은 해당 섹션에 추가하세요.
