# CommentGuard — Development Plan

**Technical Roadmap & Sprint Breakdown**
Version 2.2 | 2025 | Confidential

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

### 설계 원칙: Local-First, 단계별 확장

> 로컬에서 개발 및 테스트 → Vercel / Railway / R2로 배포.
> 팀이 생기거나 트래픽이 급증하는 시점에 인프라를 교체한다.
> 교체는 인터페이스를 유지하면서 내부 구현만 바꾸는 방식으로 한다.

### 1.1 배포 구조

```
┌─────────────────────────────────────────────┐
│  Vercel                                     │
│  Next.js Dashboard + API Routes (BFF)       │
└─────────────────┬───────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────┐
│  Railway                                    │
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

### 1.2 로컬 실행 구조 (개발 시)

```bash
# 터미널 1
brew services start postgresql

# 터미널 2 — Collector + Classifier
cd python-service && uvicorn main:app --reload --port 8001

# 터미널 3 — Next.js Dashboard + API Routes
cd dashboard && pnpm dev   # port 3000
```

> BFF는 별도 서버 없음. Next.js API Routes가 BFF 역할을 담당한다.

### 1.3 Data Pipeline

```
① YouTube Data API v3
       ↓
② Collector (Railway / Python FastAPI)
       → R2 스냅샷 저장 + SHA-256 해시  ← 분류 전에 반드시 먼저
       ↓
③ Risk Classifier (Railway / Python FastAPI, HTTP 직접 호출)
       ↓
④ PostgreSQL (Railway)
       댓글 + 분류 결과 저장
       ↓
⑤ Next.js API Routes (Vercel)
       ↔ Dashboard UI
       ↓
⑥ 고위험 댓글 → Evidence Service → PDF 생성 → R2 저장
```

### 1.4 Phase별 인프라 비교

|         |Phase 1 (MVP / 혼자)      |Phase 3+ (스케일)             |
|---------|------------------------|---------------------------|
|**프론트엔드**|Vercel                  |Vercel (동일)                |
|**백엔드**  |Railway (Python FastAPI)|Railway → EKS 이전           |
|**BFF**  |Next.js API Routes      |Next.js API Routes (동일)    |
|**DB**   |Railway PostgreSQL      |Railway → RDS 이전           |
|**파일 저장**|Cloudflare R2           |R2 (동일) + S3 Object Lock 병행|
|**메시지 큐**|없음 (직접 DB write)        |Kafka                      |
|**캐시**   |없음                      |Redis                      |
|**검색**   |PostgreSQL `pg_trgm`    |Elasticsearch              |

### 1.5 Service Boundaries

|Service             |Phase 1 구현               |Phase 3+ 확장                 |
|--------------------|-------------------------|----------------------------|
|Collector           |Railway Python FastAPI   |Kafka producer 분리           |
|Risk Classifier     |Collector와 같은 Python 프로세스|수평 확장 + 배치 처리               |
|Evidence Service    |PDF 생성 + R2 저장           |R2 + S3 Object Lock 병행      |
|BFF                 |Next.js API Routes       |동일                          |
|Case Management     |— (Phase 2)              |Case ID lifecycle, 법무팀 공유 링크|
|Notification        |— (Phase 2)              |Webhook, email, Slack       |
|Report              |— (Phase 2)              |Brand Safety Report         |
|Network Intelligence|— (Phase 3)              |익명화 집계 파이프라인                |

-----

## 2. Technology Stack

### 2.1 Frontend + BFF

|Technology             |Purpose                        |비고       |
|-----------------------|-------------------------------|---------|
|Next.js 14 (App Router)|Dashboard UI + API Routes (BFF)|Vercel 배포|
|TypeScript             |전체 프론트엔드 코드베이스                 |         |
|Tailwind CSS           |UI 스타일링                        |         |
|SWR / React Query      |서버 상태 관리                       |         |
|Recharts               |분석 차트                          |         |
|Playwright             |E2E 테스트                        |         |

### 2.2 Backend (Python)

|Technology                    |Purpose               |비고        |
|------------------------------|----------------------|----------|
|Python + FastAPI              |Collector + Classifier|Railway 배포|
|PostgreSQL 15                 |전체 데이터 저장             |Railway 내장|
|Prisma (Python: Prisma Client)|ORM + 마이그레이션          |          |

### 2.3 AI / Machine Learning

|Technology                  |Purpose                   |Phase  |
|----------------------------|--------------------------|-------|
|OpenAI GPT-4o (API)         |맥락 기반 법적 분류               |Phase 1|
|In-house Rule Engine        |법령 키워드 매핑; GPT-4o fallback|Phase 1|
|content hash 기반 in-memory 캐싱|GPT-4o 비용 / 지연 관리         |Phase 1|
|KoBERT / KoELECTRA          |한국어 감성 및 의도 분류            |Phase 2|
|scikit-learn                |계정 이상 감지                  |Phase 2|
|Anonymization Pipeline      |네트워크 집계용 비식별화             |Phase 3|

### 2.4 Infrastructure

|Technology          |Role                         |Phase  |
|--------------------|-----------------------------|-------|
|Vercel              |Next.js 배포 (git push → 자동 배포)|Phase 1|
|Railway             |Python FastAPI + PostgreSQL  |Phase 1|
|Cloudflare R2       |증거 파일 저장 (egress 무료, S3 호환)  |Phase 1|
|GitHub Actions      |CI (lint → test → build)     |Phase 1|
|AWS S3 + Object Lock|증거 불변성 강제 (WORM)             |Phase 3|
|Kafka               |댓글 수집 이벤트 스트리밍               |Phase 3|
|Redis               |캐시, 세션, pub/sub              |Phase 3|
|Elasticsearch       |풀텍스트 검색                      |Phase 3|
|AWS EKS             |컨테이너 오케스트레이션                 |Phase 3|


> **R2 사용 이유:**
> S3 대비 egress 비용 $0 (S3는 $0.09/GB).
> 증거 PDF 다운로드가 잦을수록 비용 차이가 커진다.
> S3 SDK 호환 — `endpoint_url`만 변경하면 코드 수정 없음.
> 
> **Object Lock 주의:**
> R2는 Object Lock 미지원. Phase 3에서 증거 불변성 강제가 필요할 때
> S3를 병행하거나 이전한다. MVP 단계에서는 R2로 충분하다.

-----

## 3. Core Data Model

> `[MVP]` — Phase 1 구현. 이후 Phase 엔티티는 스키마 정의만 해두고 마이그레이션은 해당 Phase에서 실행.

|Entity          |Phase  |Key Fields                                                                                                                                     |
|----------------|-------|-----------------------------------------------------------------------------------------------------------------------------------------------|
|Channel         |MVP    |`id`, `platform`, `platform_channel_id`, `mcn_id`, `api_credentials_ref`, `created_at`                                                         |
|Comment         |MVP    |`id`, `channel_id`, `platform_comment_id`, `text`, `author_id`, `created_at`, `snapshot_r2_key`, `snapshot_hash`                               |
|RiskAssessment  |MVP    |`comment_id`, `risk_types[]`, `legal_score`, `brand_score`, `urgency_score`, `recommended_action`, `model_version`                             |
|Action          |MVP    |`id`, `comment_id`, `action_type`, `approved_by`, `approved_at`, `executed_at`, `platform_response`                                            |
|EvidencePackage |MVP    |`id`, `case_id`, `comment_ids[]`, `pdf_r2_key`, `timeline_page_included`, `created_at`, `checksum`, `created_by`, `custody_log_r2_key`         |
|AccountPattern  |MVP    |`author_id`, `comment_count_30d`, `is_new_account`, `ip_cluster_id`, `flagged_at`                                                              |
|Case            |Phase 2|`id`, `mcn_id`, `title`, `status`, `created_by`, `created_at`, `comment_ids[]`, `account_ids[]`, `video_ids[]`, `linked_evidence_package_ids[]`|
|LawFirmShareLink|Phase 2|`id`, `evidence_package_id`, `token_hash`, `expires_at`, `is_active`, `created_by`, `access_log[]`                                             |
|Campaign        |Phase 2|`id`, `brand_id`, `channel_ids[]`, `keyword_watch_list[]`, `start_at`, `end_at`, `brand_safety_score`                                          |
|NetworkPattern  |Phase 3|`id`, `keyword_set_hash`, `risk_type`, `occurrence_count_30d`, `legal_filing_rate_30d`, `computed_at`                                          |


> **Case status lifecycle:** `Open → UnderReview → Packaged → Referred → Closed`
> 역방향 전환 없음. 스텝 스킵 없음.

**불변 엔티티** — UPDATE 쿼리 작성 금지:

- `Comment` (스냅샷)
- `custody_log`
- `EvidencePackage`

-----

## 4. Development Roadmap

|Phase          |Duration|배포 환경                |Goal      |Key Deliverables                           |
|---------------|--------|---------------------|----------|-------------------------------------------|
|Phase 0 — Setup|3일      |로컬                   |개발 환경 구성  |DB 스키마, GitHub Actions, R2 버킷, `.env`      |
|Phase 1 — MVP  |4 weeks |로컬 → Vercel + Railway|핵심 기능 동작  |수집, 분류, 대시보드, 증거 PDF, Action 워크플로우         |
|Phase 2 — Beta |8 weeks |Vercel + Railway     |MCN 10곳 베타|Case ID, 법무팀 공유 링크, Brand Safety Report, 빌링|
|Phase 3 — GA   |4 weeks |Vercel + EKS         |정식 출시     |Kafka, Redis, 빌링 정식, 광고주 포털                |
|Phase 4 — Scale|Ongoing |Vercel + EKS         |ML 고도화    |TikTok / X 연동, 다국어, Network Intelligence   |

-----

## 5. MVP Sprint Plan (Phase 1 — 4 Weeks)

> 개인 개발. 로컬에서 테스트 후 Vercel + Railway로 배포.

### Phase 0 (3일): 환경 세팅

|Story                                     |Notes                                                           |
|------------------------------------------|----------------------------------------------------------------|
|폴더 구조 확정 (`/python-service`, `/dashboard`)|                                                                |
|PostgreSQL 로컬 설치 + MVP 스키마 마이그레이션 (Prisma)|MVP 엔티티 6개                                                      |
|`.env` 파일 구조 확정                           |YouTube API key, OpenAI key, R2 credentials, DB URL, Railway URL|
|Cloudflare R2 버킷 생성 + 경로 구조 확정            |`/snapshots`, `/evidence-pdf`                                   |
|GitHub Actions CI (lint → test → build)   |                                                                |
|Vercel 프로젝트 연결 + Railway 프로젝트 생성          |git push → 자동 배포 확인                                             |

### Sprint 1 (Week 1): 수집 & 스냅샷

|Story                                     |Notes           |
|------------------------------------------|----------------|
|YouTube Data API v3 Collector — 댓글 수집     |5분 polling      |
|R2 스냅샷 저장 — 분류 실행 **전**에 먼저 저장            |Critical Rule #2|
|SHA-256 해시 계산 → `Comment.snapshot_hash` 저장|                |
|Collector → Classifier HTTP 직접 호출         |Kafka 없음        |
|분류 결과 → PostgreSQL 저장 (`RiskAssessment`)  |                |

### Sprint 2 (Week 2): 분류 엔진

|Story                                          |Notes              |
|-----------------------------------------------|-------------------|
|Rule-based classifier — 법령 키워드 매핑              |형사법, 정보통신망법 기준     |
|GPT-4o API 연동 — 맥락 기반 분류 프롬프트                  |                   |
|content hash 기반 in-memory 캐싱                   |Redis 아님, `dict` 기반|
|Legal / Brand / Urgency 점수 계산 로직               |                   |
|오분류 피드백 엔드포인트 → 로컬 로그 파일                       |                   |
|`requirements.txt` 정리: redis, kafka-python 없을 것|                   |

### Sprint 3 (Week 3): 대시보드 & Action 워크플로우

|Story                                         |Notes           |
|----------------------------------------------|----------------|
|Next.js 앱 + 인증 (NextAuth.js + Google SSO)     |                |
|대시보드 홈 — 위험 카드, 7일 트렌드, 유형 분포                 |                |
|댓글 목록 + 상세 패널 (점수, 분류 결과, 법령 참조)              |                |
|Action UI (무시 / 숨김 / 삭제 / 증거 보존 후 삭제) + 1클릭 승인|`approved_by` 필수|
|플랫폼 API hide / delete 실행 (승인 후)               |Critical Rule #1|
|Next.js API Routes — Railway Python 서비스 프록시   |                |

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

|Risk                |Severity|Mitigation                                         |
|--------------------|--------|---------------------------------------------------|
|YouTube API quota 초과|High    |5분 polling; in-memory 중복 필터; 초과 시 알림 후 중단          |
|YouTube API 정책 변경   |High    |Rule-engine-only fallback; `"provisional": true` 표시|
|GPT-4o 비용 급증        |Medium  |content hash in-memory 캐싱; 저위험 댓글 rule-engine-only |
|한국어 분류 정확도          |High    |Rule engine 우선; GPT-4o 보조; 오분류 피드백 로그              |
|오분류                 |High    |인간 승인 게이트; 피드백 엔드포인트; 월간 수동 검토                     |
|R2 Object Lock 미지원  |Medium  |MVP 단계 허용; Phase 3에서 S3 병행 또는 이전                   |
|Railway 다운타임        |Low     |MVP 단계 허용; Phase 3에서 EKS 이전                        |
|개인정보 처리 위반          |High    |데이터 최소화; PIPA 검토; 계약서 조항 명시                        |
|NetworkPattern 재식별  |High    |k-anonymity ≥50채널; PII 필드 없음 (Phase 3)             |

-----

## 7. QA & Security Policy

### 7.1 Test Strategy

- **Unit tests:** Pytest (Python) + Jest (TypeScript) — 핵심 분류 로직 우선
- **E2E tests:** Playwright — `수집 → 분류 → 승인 → PDF 생성` 핵심 플로우
- **수동 테스트:** 실제 YouTube 채널로 end-to-end 매 스프린트 말 확인

### 7.2 Security Policy

- **Authentication:** NextAuth.js + Google SSO + JWT
- **Authorization:** Admin 단일 권한 (Phase 1); RBAC는 Phase 2에서 추가
- **Encryption in transit:** TLS (Vercel + Railway 기본 제공)
- **Encryption at rest:** R2 서버사이드 암호화 기본 제공
- **Evidence immutability:** Phase 1은 R2 일반 저장; Phase 3에서 S3 Object Lock 병행
- **R2 presigned URL:** 증거 PDF 다운로드는 presigned URL 사용 (직접 노출 금지)

-----

*This document is confidential property of CommentGuard Inc. Unauthorized distribution is prohibited.*
*© 2025 CommentGuard Inc.*