# CommentGuard — Development Checklist

> Claude Code: Run through the relevant section(s) before every commit or PR.
> If any item fails, fix it before proceeding.

---

## Phase 0 — 환경 세팅 (일회성)

> 최초 1회만 실행. 루트 `.env`에 외부 키가 채워진 이후 실행.

- [ ] 루트 `.env` 파일 생성 (`cp .env.example .env`) — **단일 파일, 서비스별 .env 생성 금지**
- [ ] `JWT_SECRET` 생성 후 루트 `.env`에 입력
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- [ ] `INTERNAL_SECRET` 생성 후 루트 `.env`에 입력
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] `docker-compose up` 실행 후 전체 서비스 health check 통과
  ```bash
  curl http://localhost:3001/health   # bff-api
  curl http://localhost:8001/health   # risk-classifier
  curl http://localhost:3000          # web (Next.js)
  ```
- [ ] Prisma migration 적용
  ```bash
  docker-compose exec bff-api pnpm --filter @commentguard/db exec prisma migrate deploy
  ```
- [ ] Prisma Client 재생성
  ```bash
  docker-compose exec bff-api pnpm run db:generate
  ```
- [ ] Playwright 브라우저 설치
  ```bash
  pnpm --filter @commentguard/web exec playwright install chromium
  ```

---

## 0. Before Writing Any Code

- [X] Have you read `CLAUDE.md`?
- [X] Have you read `DESIGN.md`?
- [X] Have you read `CommentGuard_Development_Plan_v4.md`? (Architecture, Sprint Plan, Risk Mitigations)
- [ ] Is the feature in scope for the **current sprint**? (check `CLAUDE.md` § Current Phase)
- [ ] Is this a Phase 2+ feature being implemented in Phase 1? If yes, stop — add schema stub only, no logic.

---

## 1. Evidence Integrity

> Applies to: Collector Service, Evidence Service, any code that touches R2 or EvidencePackage

- [X] Snapshot is written to R2 **before** any classification or action runs
- [X] `Comment.snapshot_r2_key` (R2 object key) is stored in DB alongside `snapshot_hash`
- [X] SHA-256 hash is computed at ingest and stored **separately** from the file
- [X] Hash is verified on every read (not just on write)
- [X] R2 bucket has server-side encryption enabled (Phase 1); S3 Object Lock (WORM) deferred to Phase 3
- [X] EvidencePackage PDF includes:
  - [X] Incident timeline page
  - [X] Chain of custody log page
  - [X] Checksum block (hash + algorithm + timestamp)
  - [X] Applicable legal statute references
  - [X] Account behavior pattern report (comment frequency, high-risk ratio, repeat attack pattern)
- [X] `EvidencePackage.custody_log_r2_key` points to R2 — custody log is stored immutably in R2, not only in DB

---

## 2. Chain of Custody

> Applies to: Evidence Service, Case Management Service, any audit log writes

- [X] Custody log is **append-only** — no `UPDATE` or `DELETE` queries exist on `custody_log`
- [X] Every custody log entry contains: `actor_id`, `action`, `timestamp`, `ip_address`
- [X] Case status transitions follow the defined lifecycle only:
  `Open → UnderReview → Packaged → Referred → Closed`
  No skipping steps. No reverse transitions.
- [X] EvidencePackage has `case_id` set — orphaned packages (no case link) should not be created

---

## 3. Action Workflow — Strict Scope

> Applies to: Action Service, any endpoint that calls platform APIs
>
> **CommentGuard Action은 2종만 존재한다:**
> 1. **Open on Platform** — 플랫폼 링크로 이동. 상태 변화 없음. DB 기록 없음. Tool에 가까움.
> 2. **Request Legal Review** — Legal Hold 활성화. 파기 차단. 법무팀 공유 링크 발급.
>
> 댓글 삭제·차단·숨김은 CommentGuard가 실행하지 않는다.
> 담당자가 플랫폼에서 직접 수행한다.

- [X] **플랫폼 삭제·차단·숨김 API를 호출하는 코드 경로가 존재하지 않는다**
- [X] Action Service에 `hide`, `delete`, `block` 관련 엔드포인트가 없다
- [X] `approved_by` 필드는 실제 사용자 ID — 시스템/봇 ID 절대 불가
- [X] `approved_at` 타임스탬프가 `approved_by`와 함께 기록된다
- [X] API 리스크 점수 응답에 면책 레이블 포함:
  `"classification": "reference_only"` (절대 생략 불가)
- [X] 스케줄러 또는 백그라운드 워커가 플랫폼 Action을 자율 실행하는 경로가 없다
- [X] "Open on Platform"은 DB 상태 변화를 유발하지 않는다 — 순수 링크 리디렉션만 허용

---

## 4. Data Retention — Hot Forever

> Applies to: Evidence Service, any purge or TTL logic
>
> **고위험 댓글(legal_score ≥ 0.7)은 전체를 Hot으로 무기한 보관한다.**
> Warm 단계 없음. 자동 파기 없음. TTL 없음.

- [X] Phase 2 수집 댓글에 TTL 또는 자동 파기 타이머가 설정되어 있지 않다
- [X] Warm 데이터 레이어(메타데이터 전용)로 전환하는 코드 경로가 없다
- [X] 스케줄러 또는 백그라운드 워커가 Hot 데이터를 자동으로 파기하는 경로가 없다
- [X] 파기는 담당자의 명시적 요청이 있을 때만 실행된다
- [X] 파기 실행 시 Cold Tombstone(파기 타임스탬프 + policy_id + actor_role)이 반드시 생성된다
- [X] Legal Hold 활성화 중 파기 요청은 시스템이 차단한다 — 에러 반환, 조용한 무시 금지
- [X] DEV 전용 yt-dlp 수집 데이터의 TTL 48시간 자동 삭제는 유지 — 프로덕션 데이터와 혼동 금지

---

## 5. Legal Hold

> Applies to: Evidence Service, Action Service, any purge pathway

- [X] 법적 검토 요청 Action 실행 즉시 Legal Hold 활성화
- [X] Legal Hold 활성화 중:
  - [X] 해당 댓글의 모든 파기 요청 차단
  - [X] Cold Tombstone 전환 차단
  - [X] 파기 관련 API 호출 시 명시적 에러 반환 (`403 Legal Hold Active`)
- [X] Legal Hold는 담당자가 수동으로 해제하기 전까지 유지
- [X] Legal Hold 해제 이벤트가 custody log에 기록된다 (`hold_released` + actor_id + timestamp)
- [X] Legal Hold 해제 후 파기 여부는 담당자가 별도 판단 — 자동 파기 트리거 없음

---

## 6. Law Firm Share Link

> Applies to: Case Management Service, any endpoint under `/share-links`

- [X] Share link endpoints are **read-only** — only `GET` methods allowed
- [X] Token is a cryptographic hash — never a sequential ID or guessable string
- [X] `expires_at` is always set — no non-expiring tokens
- [X] Every access (even failed attempts) is logged: `ip`, `user_agent`, `accessed_at`
- [X] Anomaly detection threshold is configured (e.g., >10 accesses/hour → auto-revoke)
- [X] Link revocation works immediately — no cache delay on invalidation

---

## 7. Data Model

> Applies to: any migration or schema change

- [X] New migration file created — existing migrations are **never modified**
- [X] All new entities have `created_at`
- [X] Immutable records (Evidence, CustodyLog, Snapshot) have **no** `updated_at` and **no** `UPDATE` routes
- [X] `NetworkPattern` entity does **not** contain any of:
  - `channel_id`
  - `author_id`
  - `mcn_id`
  - Any field that could identify a subscriber or commenter
- [X] k-anonymity threshold enforced: a pattern is only written when derived from ≥ 50 distinct channels
- [X] `AccountPattern` (MVP) does not store raw IP — only `ip_cluster_id` (anonymized cluster token)
- [X] `AccountPattern` fields limited to: `author_id`, `comment_count_30d`, `high_risk_ratio`, `repeat_attack_flag`, `is_new_account`, `ip_cluster_id`, `flagged_at` — no PII beyond author handle
- [X] Phase 2 entities (`Case`, `LawFirmShareLink`, `Campaign`) are schema-stubbed only in Phase 1 — no business logic wired
- [X] New entity added to `docs/DATA_MODEL.md` before the migration is merged
- [X] Hot 데이터에 `expires_at` 또는 `ttl` 컬럼이 없다 — 있으면 즉시 제거

---

## 8. API Design

> Applies to: all new or modified endpoints

- [X] Endpoint follows REST conventions — resource nouns, correct HTTP verbs
- [X] Auth required on all endpoints — no unprotected routes except `/health`
- [X] RBAC role checked:
  - Super Admin / Channel Manager / Viewer for operator routes
  - Law Firm role for share link routes (read-only, evidence-scoped)
- [X] Rate limiting configured per tenant — not globally
- [X] Response never includes raw comment data outside the subscriber's own scope
- [X] Error responses do not leak internal stack traces or DB details

---

## 9. Network Intelligence Service

> Applies to: anonymization pipeline, NetworkPattern writes, aggregate API

- [X] Raw comment content is **never** written to the aggregate store
- [X] De-identification runs before any cross-channel computation
- [X] Output of aggregation is verified to contain no channel-level or author-level fields
- [X] Aggregate is only surfaced via the Network Intelligence API — never directly from the DB
- [ ] PIPA compliance check completed if adding a new field to the aggregate pipeline

---

## 10. Platform API (YouTube / Instagram)

> Applies to: Collector Service, any platform API call

- [X] All calls are within official API permissions — no scraping
- [X] **플랫폼 삭제·차단·숨김 API는 호출하지 않는다** — CommentGuard는 읽기 전용
- [X] Quota usage is tracked per API credential account
- [X] Multiple API credential accounts configured — quota exhaustion triggers automatic rotation to next account
- [X] Fallback to rule-engine-only mode is implemented if API response schema changes
  (scores flagged as `"provisional": true` in fallback mode)
- [X] API policy change detection: if required fields are missing from response → alert ops, do not silently fail

---

## 11. Classification & ML

> Applies to: Risk Classifier Service, rule engine, scoring logic

- [X] Misclassification correction endpoint exists and routes to the retraining queue
- [X] Model version is stored with every `RiskAssessment` record (`model_version` field)
- [X] Rule engine override path is functional — ML score can be overridden by rule engine for legal statute keywords
- [X] No classification result is surfaced as a legal determination — always labeled as reference only
- [X] Monthly accuracy audit query exists (confirmed legal cases vs. classification result at time of incident)
- [X] GPT-4o calls are deduplicated — identical comment text does not trigger a new API call (cached by content hash)
- [X] Korean-language comments route through KoBERT / KoELECTRA inference before rule engine arbitration — not skipped
- [X] Account anomaly detection (coordinated attack signals) runs via `AccountPattern` — `is_new_account` and `ip_cluster_id` populated at ingest
- [X] Urgency score는 큐 정렬·알림 우선순위·SLA 결정에만 사용된다 — 파기·보관·법적 판단의 근거로 사용 금지
- [X] GPT-4o 프롬프트는 법적 구성요소 체크리스트 형식 — 사실적시 명예훼손 등 키워드 없는 고위험 댓글 탐지 가능

---

## 12. Security

> Applies to: all code, but especially auth, encryption, and external-facing endpoints

- [X] TLS 1.3 enforced — no fallback to older TLS versions
- [X] All evidence files and snapshots encrypted at rest via R2 server-side encryption (Phase 1); AWS KMS deferred to Phase 3
- [X] MFA enforced for all operator accounts — no bypass path in code
- [X] No secrets, API keys, or credentials in source code or logs
- [ ] OWASP Top 10 checklist reviewed for any new external-facing endpoint
- [ ] **GA gate:** External penetration test completed before public launch — do not ship to GA without sign-off

---

## 13. Docker & 환경 설정

> Applies to: docker-compose.yml, 환경변수, 서비스 간 URL

- [ ] 루트 `.env` 단일 파일 사용 — 서비스별 `.env` 없음
- [ ] `docker-compose.yml`에서 모든 서비스에 환경변수 주입
- [ ] 서비스 간 URL은 Docker 내부 네트워크 이름 사용
  - bff-api → risk-classifier: `http://risk-classifier:8001`
  - web → bff-api: `http://bff-api:3001`
  - bff-api → callback: `http://bff-api:3001/internal/...`
- [ ] URL fallback 하드코딩 없음 — `process.env.XXX ?? "http://hardcoded"` 패턴 금지
  - 환경변수 없으면 서버 시작 시 명시적 에러로 처리
- [ ] DEV ONLY 엔드포인트는 `NODE_ENV !== "development"` 체크 후 404 반환
- [ ] `docker-compose up` 후 모든 서비스 health check 통과 확인

---

## 14. Tests

> Applies to: all PRs

- [X] Unit test coverage ≥ 80% for changed files (Jest for frontend, Pytest for Python services)
- [ ] Integration test covers the full flow for any new service interaction
- [ ] API integration tests use **Supertest** — not mocked HTTP
- [ ] Integration tests wrap DB writes in a transaction and roll back after each test — no persistent test data
- [ ] E2E test updated if a user-facing flow changed:
  `collection → classification → Request Legal Review → Legal Hold → PDF generation → share link`
- [ ] Load test baseline is not regressed (P99 < 2s at 100K comments/hour)
- [X] New custody log / chain of custody path has a dedicated integrity test
- [ ] Legal Hold 활성화 중 파기 시도가 `403`을 반환하는 테스트가 존재한다
- [ ] Hot 데이터에 자동 파기 타이머가 없음을 검증하는 테스트가 존재한다

---

## 15. PR Description

- [ ] PR description states which sprint story this closes
- [ ] If a DECISION was made during this PR (e.g., chose approach A over B), it is added to `docs/DECISIONS.md`
- [ ] If a new "never do X" rule emerged, it is added to this `CHECKLIST.md`
- [ ] `CLAUDE.md` § Current Phase updated if a sprint story is now complete

---

> **Rule:** If you are unsure whether a checklist item applies, assume it does.
> The cost of a false positive check is zero. The cost of a missed evidence integrity bug is a failed legal case.
>
> **절대 금지 (Never Do):**
> - 플랫폼 삭제·차단·숨김 API 호출
> - Phase 2 Hot 데이터에 TTL 또는 자동 파기 설정
> - Warm 레이어 생성 또는 Hot → Warm 전환 로직 추가
> - Legal Hold 활성화 중 파기 실행
> - Urgency 점수를 법적 판단·삭제·보관의 근거로 사용
> - 서비스별 `.env` 파일 생성 (루트 `.env` 단일 파일 원칙)
> - URL fallback 하드코딩 (`process.env.XXX ?? "http://hardcoded-url"`)
> - `docker-compose up` 없이 서비스 직접 실행 (로컬 개발 시)
