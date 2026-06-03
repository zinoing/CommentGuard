# CommentGuard — Phase 1 남은 작업

> 이 파일은 코드 자동화로 처리할 수 없는 작업들 목록입니다.
> 완료 시 `[x]`로 표시하세요.

---

## 1. 지금 당장 실행해야 할 것

### 1-1. 의존성 / 스키마 동기화

```bash
# Prisma migration 적용 (DB 실행 중이어야 함)
pnpm --filter @commentguard/db exec prisma migrate deploy

# Prisma Client 재생성
pnpm run db:generate
```

- [x] `pnpm install` 실행 완료
- [x] Prisma migration 파일 생성 완료 (`20260603000001_phase1_account_pattern_evidence_fields`)
- [ ] Prisma migration DB 적용 (`prisma migrate deploy`) — **DB 실행 후 수동 실행 필요**
- [ ] `pnpm run db:generate` 실행 완료

### 1-2. 환경변수 파일 설정

```bash
cp .env.example .env
# .env 열어서 아래 값들 실제로 채우기
```

- [ ] `JWT_SECRET` 생성 및 입력
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- [ ] `YOUTUBE_API_KEY` 입력
- [ ] `OPENAI_API_KEY` 입력
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `NEXTAUTH_SECRET` 입력

### 1-3. LocalStack S3 버킷 초기화

docker-compose up 이후 버킷을 수동으로 생성해야 합니다:

```bash
docker-compose up -d postgres localstack
aws --endpoint-url=http://localhost:4566 s3 mb s3://commentguard-evidence-dev --region ap-northeast-2
```

- [ ] LocalStack S3 버킷 생성 완료

### 1-4. 로컬 스택 동작 검증

```bash
docker-compose up
curl http://localhost:3001/health   # bff-api
curl http://localhost:8001/health   # risk-classifier
curl http://localhost:3002/health   # collector-service
curl http://localhost:3003/health   # evidence-service
curl http://localhost:3004/health   # action-service
```

- [ ] 전체 서비스 health check 통과

### 1-5. Playwright 브라우저 설치

```bash
pnpm --filter @commentguard/web exec playwright install chromium
```

- [ ] Playwright 브라우저 설치 완료

---

## 2. 외부 계정 / 키 발급

- [ ] **YouTube Data API v3** — Google Cloud Console에서 활성화, API 키 발급
  - Quota 기본 10,000 units/day → 필요 시 증설 신청
  - `commentThreads.list` 권한 확인
  - 채널별 OAuth token → `.env`에 `YOUTUBE_OAUTH_TOKEN_<CREDENTIAL_REF>` 형태로 등록
- [ ] **OpenAI API** — 계정 생성, `gpt-4o` 접근 가능한 플랜 확인, API 키 발급
- [ ] **Google OAuth** — Google Cloud Console → OAuth 2.0 크레덴셜 생성
  - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
  - 운영 도메인 추가 예정

---

## 3. 남은 구현 항목

### KoBERT 모델 호스팅

- [ ] KoBERT / KoELECTRA 모델 fine-tuning 및 호스팅 환경 결정 (HuggingFace Hub 또는 자체 서버)
  - 모델 서버 기동 후 `.env`에 `KOBERT_URL=http://<host>/` 설정하면 자동 연동됨
  - 미설정 시 GPT-4o로 자동 fallback (현재 동작 중)

---

## 4. 외부 검토 (법무 어드바이저)

- [ ] **위험 분류 키워드 / 기준 검토**
  - 파일: [services/risk-classifier/app/classifiers/rule_engine.py](services/risk-classifier/app/classifiers/rule_engine.py)
  - `LEGAL_THREAT_KEYWORDS`, `HATE_SPEECH_KEYWORDS` 등 법령 기준으로 검토 필요

- [ ] **Chain of Custody 형식 검증**
  - 파일: [services/evidence-service/src/pdf/generator.ts](services/evidence-service/src/pdf/generator.ts)
  - 실제 법정 제출 가능한 형식인지 법무 어드바이저 서명 필요

- [ ] **면책 조항 문구 검토**
  - PDF 하단 disclaimer 문구 최종 확인

- [ ] **PIPA 준수 법률 검토** — `AccountPattern`의 `authorPlatformId` 저장이 개인정보 처리에 해당하는지 확인

---

## 5. GA 출시 전 (Phase 1 이후)

- [ ] AWS 실계정 S3 버킷 생성 + Object Lock Compliance Mode 활성화 (30일 최소 보존)
- [ ] AWS KMS 키 생성 (AES-256, 키 자동 로테이션 활성화)
- [ ] 외부 보안 업체 Penetration Test 완료 — CHECKLIST §10 GA gate
- [ ] MFA 강제 적용 확인 (모든 운영자 계정)

---

> 완료된 항목은 `[x]`로 체크하세요.
> 새로 발견된 작업은 해당 섹션에 추가하세요.
