# CommentGuard — Development Plan

**Technical Roadmap & Sprint Breakdown**
Version 4.0 | 2025 | Confidential

-----

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
1. [Technology Stack](#2-technology-stack)
1. [Core Data Model](#3-core-data-model)
1. [Development Roadmap](#4-development-roadmap)
1. [MVP Sprint Plan](#5-mvp-sprint-plan-phase-1--4-weeks)
1. [Technical Risks & Mitigations](#6-technical-risks--mitigations)
1. [QA & Security Policy](#7-qa--security-policy)

-----

## 1. Architecture Overview

### 설계 원칙: Docker-First 로컬 개발, 단계별 확장

> 로컬 개발은 Docker Compose로 전체 스택을 단일 명령으로 실행한다.
> 환경변수는 루트 `.env` 한 곳에서 관리한다.
> 서비스 간 URL은 Docker 내부 네트워크 이름을 사용한다 (예: `http://bff-api:3001`).
> 프로덕션 배포는 Vercel / Railway / R2로 전환한다.

### 1.1 로컬 실행 구조 (Docker Compose)

```bash
# 단일 명령으로 전체 스택 실행
docker-compose up

# 서비스별 health check
curl http://localhost:3000/health   # web (Next.js)
curl http://localhost:3001/health   # bff-api (Fastify)
curl http://localhost:8001/health   # risk-classifier (Python FastAPI)
curl http://localhost:5432          # postgres
```

**Docker 도입 이유:**
- 환경변수 분산 문제 제거 — `docker-compose.yml`에서 일괄 관리
- 서비스 간 URL 충돌 없음 — Docker 내부 네트워크 이름으로 고정
- 포트 충돌 없음 — 컨테이너별 격리
- `pnpm dev` 중복 실행 문제 없음

### 1.2 배포 구조 (프로덕션)

```
┌─────────────────────────────────────────────┐
│  Vercel                                     │
│  Next.js Dashboard + API Routes (BFF)       │
└─────────────────┬───────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────┐
│  Railway                                    │
│  Fastify BFF API                            │
│  Python FastAPI (Collector + Classifier)    │
│  PostgreSQL                                 │
└─────────────────┬───────────────────────────┘
                  │ S3-compatible API
┌─────────────────▼───────────────────────────┐
│  Cloudflare R2                              │
│  증거 파일 (PDF + 스냅샷)                    │
│  egress 무료 / S3 SDK 호환                  │
└─────────────────────────────────────────────┘
```

### 1.3 Data Pipeline

```
① yt-dlp (채널 전체 댓글 수집)
       ↓
② risk-classifier (Python FastAPI)
       → 백그라운드 Job으로 영상 1개씩 순차 수집
       → 수집 완료마다 bff-api 콜백으로 결과 전달
       ↓
③ bff-api (Fastify)
       → Comment DB upsert (platform_comment_id 중복 체크)
       → CollectJob 진행 상황 업데이트
       ↓
④ PostgreSQL
       댓글 + 분류 결과 저장 (Hot 무기한 보관)
       ↓
⑤ Next.js Dashboard
       채널별 댓글 목록, 위험 점수, 계정 패턴 리포트
       ↓
⑥ 고위험 댓글 → Evidence Service → PDF 생성 → R2 저장
```

### 1.4 환경변수 관리 원칙

```
루트 .env (단일 파일)
    ↓
docker-compose.yml에서 각 서비스로 주입
    ↓
서비스 내부: process.env.XXX 로 접근

로컬 개발: docker-compose up
프로덕션: 각 플랫폼 환경변수 설정 (Vercel / Railway)
```

**절대 금지:**
- 서비스별 `.env` 파일 분산 관리
- 코드에 URL 하드코딩 (`http://localhost:XXXX` 또는 `http://service-name:XXXX`)
- `process.env.XXX ?? "http://hardcoded-fallback"` 패턴

### 1.5 Service Boundaries

|Service             |Phase 1 구현                        |Phase 3+ 확장                  |
|--------------------|-----------------------------------|------------------------------|
|Collector           |risk-classifier Python (yt-dlp)    |Kafka producer 분리             |
|Risk Classifier     |Collector와 같은 Python 프로세스        |수평 확장 + 배치 처리               |
|BFF API             |Fastify (별도 서비스)                  |동일                            |
|Evidence Service    |PDF 생성 + R2 저장                    |R2 + S3 Object Lock 병행       |
|Case Management     |— (Phase 2)                       |Case ID lifecycle, 법무팀 공유 링크 |
|Notification        |— (Phase 2)                       |Webhook, email, Slack         |
|Report              |— (Phase 2)                       |Brand Safety Report           |
|Network Intelligence|— (Phase 3)                       |익명화 집계 파이프라인                 |

### 1.6 Phase별 인프라 비교

|         |Phase 1 (MVP / Docker 로컬)  |Phase 3+ (스케일)              |
|---------|---------------------------|------------------------------|
|**로컬**   |Docker Compose             |—                             |
|**프론트엔드**|Vercel                     |Vercel (동일)                   |
|**BFF**  |Railway (Fastify)          |Railway → EKS 이전              |
|**백엔드**  |Railway (Python FastAPI)   |Railway → EKS 이전              |
|**DB**   |Railway PostgreSQL         |Railway → RDS 이전              |
|**파일 저장**|Cloudflare R2              |R2 (동일) + S3 Object Lock 병행  |
|**메시지 큐**|없음 (직접 DB write + callback)|Kafka                         |
|**캐시**   |없음                         |Redis                         |
|**검색**   |PostgreSQL `pg_trgm`       |Elasticsearch                 |

-----

## 2. Technology Stack

### 2.1 Frontend

|Technology             |Purpose                  |비고        |
|-----------------------|-------------------------|----------|
|Next.js 14 (App Router)|Dashboard UI             |Vercel 배포  |
|TypeScript             |전체 프론트엔드 코드베이스           |          |
|Tailwind CSS           |UI 스타일링                  |          |
|SWR / React Query      |서버 상태 관리                 |          |
|Recharts               |분석 차트                    |          |
|Playwright             |E2E 테스트                  |          |

### 2.2 BFF API

|Technology   |Purpose              |비고         |
|-------------|---------------------|-----------|
|Fastify      |BFF API 서버           |Railway 배포  |
|TypeScript   |전체 BFF 코드베이스         |           |
|@fastify/jwt |JWT 인증               |           |
|Prisma       |ORM + 마이그레이션         |           |

### 2.3 Backend (Python)

|Technology    |Purpose               |비고         |
|--------------|----------------------|-----------|
|Python + FastAPI|Collector + Classifier|Railway 배포  |
|PostgreSQL 15 |전체 데이터 저장            |           |
|yt-dlp        |YouTube 댓글 수집         |           |

### 2.4 AI / Machine Learning

|Technology                  |Purpose                    |Phase   |
|----------------------------|---------------------------|--------|
|OpenAI GPT-4o (API)         |맥락 기반 법적 분류 (법적 구성요소 체크리스트)|Phase 1 |
|In-house Rule Engine        |법령 키워드 매핑; GPT-4o 1차 필터    |Phase 1 |
|content hash 기반 in-memory 캐싱|GPT-4o 비용 / 지연 관리          |Phase 1 |
|KoBERT / KoELECTRA          |한국어 감성 및 의도 분류             |Phase 2 |
|scikit-learn                |계정 이상 감지                   |Phase 2 |
|Anonymization Pipeline      |네트워크 집계용 비식별화              |Phase 3 |

**GPT-4o 분류 원칙:**
- Rule Engine은 "명백히 안전한 댓글" 필터링 용도 (비용 절감)
- 사실적시 명예훼손 등 키워드 없는 고위험 댓글은 GPT-4o만 감지 가능
- GPT 프롬프트는 법적 구성요소 체크리스트 형식 (사실 주장 여부, 명예 훼손 가능성, 공연성)
- 전체 댓글의 1~3%만 GPT에 도달 → 비용 현실적

### 2.5 Infrastructure

|Technology          |Role                          |Phase   |
|--------------------|------------------------------|--------|
|Docker Compose      |로컬 개발 환경 전체 스택 실행            |Phase 0 |
|Vercel              |Next.js 배포 (git push → 자동 배포) |Phase 1 |
|Railway             |BFF + Python FastAPI + PostgreSQL|Phase 1|
|Cloudflare R2       |증거 파일 저장 (egress 무료, S3 호환)  |Phase 1 |
|GitHub Actions      |CI (lint → test → build)      |Phase 1 |
|AWS S3 + Object Lock|증거 불변성 강제 (WORM)              |Phase 3 |
|Kafka               |댓글 수집 이벤트 스트리밍                |Phase 3 |
|Redis               |캐시, 세션, pub/sub               |Phase 3 |
|Elasticsearch       |풀텍스트 검색                       |Phase 3 |
|AWS EKS             |컨테이너 오케스트레이션                  |Phase 3 |

-----

## 3. Core Data Model

> `[MVP]` — Phase 1 구현. 이후 Phase 엔티티는 스키마 정의만 해두고 마이그레이션은 해당 Phase에서 실행.

|Entity          |Phase   |Key Fields                                                                                                                                                                                        |
|----------------|--------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Channel         |MVP     |`id`, `platform`, `platform_channel_id`, `mcn_id`, `oauth_access_token`, `oauth_refresh_token`, `last_collected_at`, `api_credentials_ref`, `created_at`                                          |
|ChannelInvite   |MVP     |`id`, `mcn_id`, `channel_name`, `token`, `status` (PENDING/ACCEPTED/EXPIRED), `expires_at`, `created_at`                                                                                         |
|CollectJob      |MVP     |`id`, `channel_id`, `status` (PENDING/RUNNING/DONE/FAILED), `total_videos`, `processed_videos`, `total_comments`, `new_comments`, `modified_comments`, `deleted_comments`, `error_message`, `created_at`, `updated_at`|
|Comment         |MVP     |`id`, `channel_id`, `platform_comment_id`, `text`, `author_id`, `created_at`, `snapshot_r2_key`, `snapshot_hash`, `legal_hold_active`, `legal_hold_activated_at`, `legal_hold_released_at`        |
|RiskAssessment  |MVP     |`comment_id`, `risk_types[]`, `legal_score`, `brand_score`, `urgency_score`, `recommended_action`, `model_version`                                                                                |
|Action          |MVP     |`id`, `comment_id`, `action_type` (`REQUEST_LEGAL_REVIEW`만 허용), `approved_by`, `approved_at`, `executed_at`                                                                                     |
|EvidencePackage |MVP     |`id`, `case_id`, `comment_ids[]`, `pdf_r2_key`, `timeline_page_included`, `created_at`, `checksum`, `created_by`, `custody_log_r2_key`                                                            |
|AccountPattern  |MVP     |`author_id`, `comment_count_30d`, `high_risk_ratio`, `repeat_attack_flag`, `is_new_account`, `ip_cluster_id`, `flagged_at`                                                                        |
|Case            |Phase 2 |`id`, `mcn_id`, `title`, `status`, `created_by`, `created_at`, `comment_ids[]`, `account_ids[]`, `video_ids[]`, `linked_evidence_package_ids[]`                                                   |
|LawFirmShareLink|Phase 2 |`id`, `evidence_package_id`, `token_hash`, `expires_at`, `is_active`, `created_by`, `access_log[]`                                                                                               |
|Campaign        |Phase 2 |`id`, `brand_id`, `channel_ids[]`, `keyword_watch_list[]`, `start_at`, `end_at`, `brand_safety_score`                                                                                            |
|NetworkPattern  |Phase 3 |`id`, `keyword_set_hash`, `risk_type`, `occurrence_count_30d`, `legal_filing_rate_30d`, `computed_at`                                                                                             |

> **Case status lifecycle:** `Open → UnderReview → Packaged → Referred → Closed`
> 역방향 전환 없음. 스텝 스킵 없음.

**불변 엔티티** — UPDATE 쿼리 작성 금지:

- `Comment` (스냅샷)
- `custody_log`
- `EvidencePackage`

**댓글 수정/삭제 처리 원칙:**

| 댓글 유형 | 수정 감지 시 | 삭제 감지 시 |
|---|---|---|
| 일반 댓글 | DB 교체 허용 | DB 삭제 허용 |
| 악플 의심 (risk_flag) | 변경 사실만 기록 | `deleted_at` 기록, DB 유지 |
| Legal Hold 활성 | 변경 사실만 기록 | `deleted_at` 기록, DB 유지 |

**데이터 보관 정책 — Hot 무기한 보관:**

> 고위험 댓글(legal_score ≥ 0.7)은 원문 전체를 무기한 Hot 상태로 보관한다.
> Warm 단계 없음. 자동 파기 없음. TTL 없음.

|단계|데이터|보관 기간|
|----|------|--------|
|Hot|원문 + 분석 결과 + 메타데이터 + SHA-256 해시|**무기한**|
|Cold (Tombstone)|파기 타임스탬프 + policy_id + actor_role|영구 (Hot 파기 시에만 생성)|

- 파기는 담당자의 명시적 요청이 있을 때만 실행
- Legal Hold 활성화 중 파기 요청은 `403 Legal Hold Active` 에러 반환
- Phase 1 수집 데이터(yt-dlp DEV)의 TTL 48시간 삭제는 유지 — 프로덕션 데이터와 혼동 금지

-----

## 4. Development Roadmap

|Phase          |Duration|배포 환경                  |Goal       |Key Deliverables                            |
|---------------|--------|-------------------------|-----------|--------------------------------------------|
|Phase 0 — Setup|3일      |Docker 로컬                |개발 환경 구성   |Docker Compose, DB 스키마, R2 버킷, `.env`       |
|Phase 1 — MVP  |4 weeks |Docker 로컬 → Vercel + Railway|핵심 기능 동작|수집, 분류, 대시보드, 증거 PDF, Action 워크플로우          |
|Phase 2 — Beta |8 weeks |Vercel + Railway         |MCN 10곳 베타 |Case ID, 법무팀 공유 링크, Brand Safety Report, 빌링|
|Phase 3 — GA   |4 weeks |Vercel + EKS             |정식 출시      |Kafka, Redis, 빌링 정식, 광고주 포털                 |
|Phase 4 — Scale|Ongoing |Vercel + EKS             |ML 고도화     |TikTok / X 연동, 다국어, Network Intelligence    |

-----

## 5. MVP Sprint Plan (Phase 1 — 4 Weeks)

> 개인 개발. Docker Compose로 로컬 실행 → Vercel + Railway로 배포.

### Phase 0 (3일): 환경 세팅

|Story                                          |Notes                                                              |
|-----------------------------------------------|-------------------------------------------------------------------|
|Docker Compose 구성 — 전체 서비스 단일 명령 실행           |`docker-compose up` 한 번으로 web, bff-api, risk-classifier, postgres 실행|
|루트 `.env` 파일 구조 확정 (단일 파일)                    |YouTube API key, OpenAI key, R2 credentials, DB URL 등 모든 환경변수      |
|PostgreSQL + MVP 스키마 마이그레이션 (Prisma)            |MVP 엔티티 전체                                                         |
|Cloudflare R2 버킷 생성 + 경로 구조 확정                 |`/snapshots`, `/evidence-pdf`                                      |
|GitHub Actions CI (lint → test → build)        |                                                                   |
|Vercel 프로젝트 연결 + Railway 프로젝트 생성               |git push → 자동 배포 확인                                                |

### Sprint 1 (Week 1): 채널 등록 & 수집 인프라

|Story                                          |Notes                                                              |
|-----------------------------------------------|-------------------------------------------------------------------|
|채널 선택 페이지 — 등록된 채널 카드 목록                     |채널 선택 시 sessionStorage(쿠키)에 channel_id 저장                         |
|채널 등록 플로우 — 일반 크리에이터 OAuth (youtube.readonly)|Google OAuth 동의 → access_token 추출 → Channel DB 등록                  |
|채널 등록 플로우 — MCN 초대 링크                         |crypto.randomBytes(32) 토큰, 7일 만료                                   |
|백그라운드 Job 구조 — yt-dlp 전체 채널 수집               |영상 1개씩 순차 수집 → bff-api 콜백 → Comment DB upsert                      |
|CollectJob 진행 상황 폴링 UI                         |신규/수정/삭제 댓글 카운트 표시                                                |
|일별 자동 스캔 스케줄러                                 |APScheduler — 매일 새벽 전체 채널 diff 수집                                  |

### Sprint 2 (Week 2): 분류 엔진

|Story                                          |Notes               |
|-----------------------------------------------|--------------------|
|Rule Engine — 법령 키워드 1차 필터                     |형사법, 정보통신망법 기준      |
|GPT-4o API 연동 — 법적 구성요소 체크리스트 프롬프트             |사실적시 명예훼손 포함        |
|content hash 기반 in-memory 캐싱                   |Redis 아님, `dict` 기반 |
|Legal / Brand / Urgency 점수 계산 로직               |                    |
|오분류 피드백 엔드포인트 → 로컬 로그 파일                       |                    |

### Sprint 3 (Week 3): 대시보드 & Action 워크플로우

|Story                                          |Notes                  |
|-----------------------------------------------|-----------------------|
|Next.js 앱 + 인증 (NextAuth.js + Google SSO)     |                       |
|대시보드 홈 — 위험 카드, 7일 트렌드, 유형 분포                 |                       |
|댓글 목록 + 상세 패널 (점수, 분류 결과, 법령 참조)              |                       |
|Action UI — 2종만: `Open on Platform` / `Request Legal Review`|플랫폼 삭제·차단·숨김 UI 절대 추가 금지|
|계정 행동 패턴 리포트 UI                               |담당자가 수치 보고 플랫폼에서 직접 조치|
|Collect 히스토리 페이지 — 수집 로그 + 관리자 수동 실행           |관리자 인증 (id: admin / pw: 0000)|

### Sprint 4 (Week 4): 증거 패키지 & 배포

|Story                                      |Notes                    |
|-------------------------------------------|-------------------------|
|증거 PDF 생성 (텍스트 + 메타데이터 + 법령 참조)            |                         |
|Evidence Package: 사건 타임라인 페이지              |반드시 포함                   |
|Evidence Package: chain of custody 로그 + 체크섬|append-only              |
|증거 보관함 UI + PDF 다운로드 (R2 presigned URL)    |                         |
|Vercel 프로덕션 배포 확인                          |                         |
|Railway 프로덕션 배포 확인                         |환경변수 점검                  |
|MVP 셀프 인수 테스트                              |실제 YouTube 채널로 end-to-end|

-----

## 6. Technical Risks & Mitigations

|Risk                    |Severity|Mitigation                                                                  |
|------------------------|--------|----------------------------------------------------------------------------|
|YouTube API quota 초과    |High    |yt-dlp 1차 수집; YouTube API는 legal_score ≥ 0.7 댓글에만 호출                       |
|YouTube API 정책 변경       |High    |Rule-engine-only fallback; `"provisional": true` 표시                         |
|GPT-4o 비용 급증            |Medium  |content hash in-memory 캐싱; Rule Engine 1차 필터로 1~3%만 GPT 도달                 |
|사실적시 명예훼손 미탐지           |High    |GPT-4o 법적 구성요소 체크리스트 프롬프트; Rule Engine만으로는 탐지 불가                           |
|한국어 분류 정확도              |High    |Rule engine 우선; GPT-4o 보조; 오분류 피드백 로그                                      |
|오분류                     |High    |인간 승인 게이트; 피드백 엔드포인트; 월간 수동 검토                                             |
|R2 Object Lock 미지원      |Medium  |MVP 단계 허용; Phase 3에서 S3 병행 또는 이전                                           |
|Railway 다운타임             |Low     |MVP 단계 허용; Phase 3에서 EKS 이전                                                |
|개인정보 처리 위반              |High    |데이터 최소화; PIPA 검토; 계약서 조항 명시                                                |
|NetworkPattern 재식별       |High    |k-anonymity ≥50채널; PII 필드 없음 (Phase 3)                                     |
|자동 파기 타이머 실수 설정         |High    |Phase 2 Hot 데이터에 TTL/expires_at 컬럼 추가 금지; 체크리스트 항목으로 매 PR 검증               |
|플랫폼 조치 API 오구현           |High    |hide/delete/block API 호출 코드 경로 존재 금지; Action Service에 해당 엔드포인트 없음 확인        |
|Legal Hold 우회            |High    |Legal Hold 활성화 중 파기 경로가 모든 코드 레이어에서 차단되는지 통합 테스트 필수                        |
|환경변수 분산으로 인한 서비스 오동작    |High    |루트 `.env` 단일 파일 원칙; 서비스별 `.env` 금지; Docker Compose에서 일괄 주입               |
|Docker 없이 로컬 실행 시 포트 충돌  |Medium  |`docker-compose up` 외 로컬 직접 실행 금지; dev.ps1 스크립트 제거                        |

-----

## 7. QA & Security Policy

### 7.1 Test Strategy

- **Unit tests:** Pytest (Python) + Jest (TypeScript) — 핵심 분류 로직 우선
- **E2E tests:** Playwright — `수집 → 분류 → Request Legal Review → Legal Hold 활성화 → PDF 생성 → 공유 링크 발급` 핵심 플로우
- **수동 테스트:** 실제 YouTube 채널로 end-to-end 매 스프린트 말 확인

### 7.2 Security Policy

- **Authentication:** NextAuth.js + Google SSO + JWT
- **Authorization:** Admin 단일 권한 (Phase 1); RBAC는 Phase 2에서 추가
- **Encryption in transit:** TLS (Vercel + Railway 기본 제공)
- **Encryption at rest:** R2 서버사이드 암호화 기본 제공
- **Evidence immutability:** Phase 1은 R2 일반 저장; Phase 3에서 S3 Object Lock 병행
- **R2 presigned URL:** 증거 PDF 다운로드는 presigned URL 사용 (직접 노출 금지)

### 7.3 Docker 로컬 개발 원칙

- `docker-compose up` 단일 명령으로 전체 스택 실행
- 환경변수는 루트 `.env` 하나만 — 서비스별 `.env` 생성 금지
- 서비스 간 URL은 Docker 내부 네트워크 이름 사용 (`http://bff-api:3001` 등)
- URL fallback 하드코딩 금지 — `process.env.XXX` 값이 없으면 서버 시작 실패로 처리

-----

*This document is confidential property of CommentGuard Inc. Unauthorized distribution is prohibited.*
*© 2025 CommentGuard Inc.*
