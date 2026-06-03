# CommentGuard — Development Plan
**Technical Roadmap & Sprint Breakdown**
Version 2.0 | 2025 | Confidential

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Core Data Model](#3-core-data-model)
4. [Development Roadmap](#4-development-roadmap)
5. [MVP Sprint Plan](#5-mvp-sprint-plan-phase-1--8-weeks)
6. [Team Composition](#6-team-composition)
7. [Technical Risks & Mitigations](#7-technical-risks--mitigations)
8. [QA & Security Policy](#8-qa--security-policy)

---

## 1. Architecture Overview

### 설계 원칙: Local-First, 단계별 확장

> 초기에는 Docker Compose 하나로 전체 스택을 로컬에서 실행한다.
> 고객이 생기고 트래픽이 발생하는 시점에 각 컴포넌트를 교체한다.
> 교체는 인터페이스를 유지하면서 내부 구현만 바꾸는 방식으로 한다.

| | Phase 1 (로컬 / MVP) | Phase 3+ (스케일) |
|---|---|---|
| **실행 환경** | Docker Compose (로컬) | AWS EKS (Kubernetes) |
| **메시지 큐** | 없음 (직접 DB write) | Apache Kafka |
| **캐시** | 없음 | Redis 7 |
| **검색** | PostgreSQL `pg_trgm` | Elasticsearch |
| **배포** | 단일 서버 (EC2 1대) | 멀티 리전 (Seoul / Tokyo DR) |
| **스토리지** | 로컬 파일시스템 → S3 | S3 + Object Lock (WORM) |

### 1.1 Data Pipeline — Phase 1 (MVP)

```
① YouTube Data API v3  →  Collector Service (Python)
②  →  PostgreSQL  (스냅샷 + 분류 결과 저장)
③  →  Risk Classifier Service (FastAPI)
④  →  Next.js Dashboard  ←  BFF API (Node.js / Fastify)
⑤ 고위험 댓글  →  Evidence Service  →  PDF 생성  →  로컬 or S3
```

### 1.2 Data Pipeline — Phase 3+ (스케일)

```
① Platform APIs (YouTube / Instagram)  →  Collector Service
②  →  Kafka topic: raw-comments  (immutable snapshot written here)
③  →  Risk Classifier Service  (ML inference + rule engine)
④  →  PostgreSQL (persistence) + Redis (real-time feed)
⑤ High-risk path  →  Evidence Service  →  S3 (AES-256 / Object Lock)
⑥  →  Case Management Service  (Case ID linking)
⑦  →  Network Intelligence Service  (anonymized aggregate pipeline)
⑧ Web dashboard  →  BFF API  →  PostgreSQL / Redis query
```

### 1.3 Service Boundaries

| Service | Phase 1 구현 | Phase 3+ 확장 |
|---|---|---|
| Collector Service | Python 스크립트 + cron | 독립 마이크로서비스 + Kafka producer |
| Risk Classifier Service | FastAPI 단일 프로세스 | 수평 확장 + 배치 처리 |
| Evidence Service | PDF 생성 + 로컬 저장 | S3 Object Lock + KMS 암호화 |
| Case Management Service | — (Phase 2에서 추가) | Case ID lifecycle, 법무팀 공유 링크 |
| Action Service | BFF 내부 함수 | 독립 서비스 + 감사 로그 |
| Notification Service | — (Phase 2에서 추가) | Webhook, email, Slack |
| Report Service | — (Phase 2에서 추가) | Brand Safety Report 자동 생성 |
| BFF API | Node.js / Fastify 단일 서버 | 독립 배포 + 인증 분리 |
| Network Intelligence Service | — (Phase 3에서 추가) | 익명화 집계 파이프라인 |

---

## 2. Technology Stack

### 2.1 Frontend

| Technology | Purpose | Rationale |
|---|---|---|
| Next.js 14 (App Router) | Web dashboard — SPA + SSR | Performance, SEO, React ecosystem |
| TypeScript | Entire frontend codebase | Type safety; large team scalability |
| Tailwind CSS | UI styling system | Consistency; rapid iteration |
| SWR / React Query | Server state management | Optimistic updates; real-time comment feed |
| Recharts | Analytics charts | Lightweight; highly customizable |
| Playwright | End-to-end testing | Cross-browser; CI-friendly |

### 2.2 Backend

| Technology | Phase 1 | Phase 3+ |
|---|---|---|
| Node.js + Fastify | BFF API (단일 서버) | BFF + 독립 마이크로서비스 |
| Python + FastAPI | Collector + Classifier (단일 프로세스) | 분리된 서비스로 추출 |
| PostgreSQL 15 | 전체 데이터 저장 (메시지 큐 역할 포함) | 주 DB (Kafka 도입 후 write 부하 감소) |
| Redis 7 | — | 캐시, 세션, pub/sub |
| Apache Kafka | — | 댓글 수집 이벤트 스트리밍 |
| Elasticsearch | — | 풀텍스트 댓글 검색 (pg_trgm으로 시작) |

### 2.3 AI / Machine Learning

| Technology | Purpose |
|---|---|
| OpenAI GPT-4o (API) | Contextual understanding; initial legal-type classification draft |
| KoBERT / KoELECTRA (fine-tuned) | Korean-language sentiment and intent classification |
| scikit-learn | Account anomaly detection (coordinated attack signals) |
| In-house Rule Engine | Legal statute keyword mapping; final score arbitration; misclassification fallback |
| Anonymization Pipeline (PySpark) | De-identification for network-level aggregate — Phase 3+ |

### 2.4 Infrastructure & DevOps

| Technology | Phase 1 | Phase 3+ |
|---|---|---|
| Docker Compose | 로컬 전체 스택 실행 | — |
| AWS EC2 (t3.medium) | 단일 서버 배포 | EKS로 교체 |
| AWS EKS + Fargate | — | 컨테이너 오케스트레이션 |
| AWS S3 + Object Lock | 증거 파일 저장 (MVP부터 적용) | WORM Compliance Mode |
| AWS KMS | — | 증거 파일 암호화 (Phase 2) |
| GitHub Actions | CI/CD (Phase 1부터) | 동일 |
| Terraform | — | Phase 2부터 IaC 적용 |
| Datadog | — | Phase 2부터 APM / 알림 |
| AWS WAF + Shield | — | Phase 3 (고객 확보 후) |

> **S3는 Phase 1부터 사용한다.**
> 증거 파일은 로컬 파일시스템에 저장하지 않는다.
> Object Lock은 Phase 2에서 활성화하되, 버킷 구조는 처음부터 맞춰둔다.

---

## 3. Core Data Model

> Phase 1에서 구현하는 엔티티에는 `[MVP]` 표시.
> 이후 단계 엔티티는 스키마만 정의해두고 마이그레이션은 해당 Phase에서 실행.

| Entity | Phase | Key Fields |
|---|---|---|
| Channel | MVP | `id`, `platform`, `platform_channel_id`, `mcn_id`, `api_credentials_ref`, `created_at` |
| Comment | MVP | `id`, `channel_id`, `platform_comment_id`, `text`, `author_id`, `created_at`, `snapshot_s3_key`, `snapshot_hash` |
| RiskAssessment | MVP | `comment_id`, `risk_types[]`, `legal_score`, `brand_score`, `urgency_score`, `recommended_action`, `model_version` |
| Action | MVP | `id`, `comment_id`, `action_type`, `approved_by`, `approved_at`, `executed_at`, `platform_response` |
| EvidencePackage | MVP | `id`, `case_id`, `comment_ids[]`, `pdf_s3_key`, `timeline_page_included`, `created_at`, `checksum`, `created_by`, `custody_log_s3_key` |
| AccountPattern | MVP | `author_id`, `comment_count_30d`, `is_new_account`, `ip_cluster_id`, `flagged_at` |
| Case | Phase 2 | `id`, `mcn_id`, `title`, `status`, `created_by`, `created_at`, `comment_ids[]`, `account_ids[]`, `video_ids[]`, `linked_evidence_package_ids[]` |
| LawFirmShareLink | Phase 2 | `id`, `evidence_package_id`, `token_hash`, `expires_at`, `is_active`, `created_by`, `access_log[]` |
| Campaign | Phase 2 | `id`, `brand_id`, `channel_ids[]`, `keyword_watch_list[]`, `start_at`, `end_at`, `brand_safety_score` |
| NetworkPattern | Phase 3 | `id`, `keyword_set_hash`, `risk_type`, `occurrence_count_30d`, `legal_filing_rate_30d`, `computed_at` |

> **Case status lifecycle:** `Open → UnderReview → Packaged → Referred → Closed`
> 역방향 전환 없음. 스텝 스킵 없음.

---

## 4. Development Roadmap

| Phase | Duration | Goal | Key Deliverables |
|---|---|---|---|
| Phase 0 — Setup | 1 week | 로컬 환경 구성 | Docker Compose, DB 스키마, GitHub Actions |
| Phase 1 — MVP | 6 weeks | 핵심 기능 로컬 동작 | 수집, 분류, 대시보드, 증거 PDF, Action 워크플로우 |
| Phase 2 — Beta | 8 weeks | MCN 10곳 베타 운영 | Case ID, 법무팀 공유 링크, Brand Safety Report, 빌링 alpha |
| Phase 3 — GA | 4 weeks | 정식 출시 | Kafka, Redis 도입, 빌링 정식, 광고주 포털, 공개 문서 |
| Phase 4 — Scale | Ongoing | ML 고도화, 플랫폼 확장 | TikTok / X 연동, 다국어, Network Intelligence |

---

## 5. MVP Sprint Plan (Phase 1 — 6 Weeks)

### Sprint 1 (Week 1): 로컬 환경 & 수집

| Story | Owner | Points |
|---|---|---|
| Docker Compose 구성 (PostgreSQL + FastAPI + Next.js) | Full-stack | 5 |
| GitHub Actions CI 파이프라인 (lint → test → build) | Infra | 3 |
| PostgreSQL 스키마 + 초기 마이그레이션 (MVP 엔티티) | Backend | 5 |
| YouTube Data API v3 Collector — 댓글 수집 + S3 스냅샷 | Backend | 13 |
| SHA-256 해시 계산 + DB 저장 (snapshot_hash) | Backend | 5 |

### Sprint 2 (Week 2): 분류 엔진

| Story | Owner | Points |
|---|---|---|
| Rule-based classifier — 법령 키워드 매핑 | ML / Backend | 13 |
| GPT-4o API 연동 — 맥락 기반 분류 프롬프트 엔지니어링 | ML | 13 |
| Legal / Brand / Urgency 점수 계산 로직 | Backend | 8 |
| 계정 이상 감지 (반복 횟수, 신규 계정 플래그) | ML | 8 |
| 분류 결과 PostgreSQL 저장 | Backend | 3 |
| 오분류 피드백 엔드포인트 → 리트레이닝 큐 | ML / Backend | 5 |

### Sprint 3 (Week 3): 대시보드 & Action 워크플로우

| Story | Owner | Points |
|---|---|---|
| Next.js 앱 + 인증 (NextAuth.js + Google SSO) | Frontend | 8 |
| 대시보드 홈 — 위험 카드, 7일 트렌드, 유형 분포 | Frontend | 13 |
| 댓글 목록 + 상세 패널 (점수, 분류 결과, 법령 참조) | Frontend | 13 |
| Action UI (무시 / 숨김 / 삭제 / 증거 보존 후 삭제) + 1클릭 승인 | Frontend / Backend | 13 |
| 플랫폼 API hide / delete 실행 (승인 후) | Backend | 8 |
| Case ID 생성 UI — 댓글 / 계정 / 영상 묶기 | Frontend / Backend | 8 |

### Sprint 4 (Week 4): 증거 패키지 & QA

| Story | Owner | Points |
|---|---|---|
| 증거 PDF 생성 서비스 (텍스트 + 메타데이터 + 스크린샷 + 법령) | Backend | 13 |
| Evidence Package: 사건 타임라인 페이지 | Backend | 8 |
| Evidence Package: chain of custody 로그 페이지 + 체크섬 | Backend | 8 |
| 증거 보관함 UI + PDF 다운로드 + Case 연결 뷰 | Frontend | 8 |
| E2E 테스트 (Playwright) — 핵심 플로우, ≥80% 커버리지 | QA | 13 |
| MVP 인수 테스트 + 베타 고객 온보딩 준비 | PM | 5 |

---

## 6. Team Composition

| Role | Headcount | Responsibilities |
|---|---|---|
| Product Manager | 1 | 로드맵, 스프린트 관리, 고객 인터뷰 |
| Backend Engineer | 2 | API, Collector, Classifier 연동, DB 설계, Case Management |
| ML Engineer | 1 | 분류 모델, 프롬프트 엔지니어링, 점수 로직, 오분류 피드백 루프 |
| Frontend Engineer | 2 | 대시보드, Action 워크플로우 UI, Case ID UI, 리포트 뷰 |
| Infrastructure / DevOps | 1 | Docker Compose, AWS, CI/CD, 보안 |
| Legal Advisor | 1 (part-time) | 위험 분류 기준 검토, 면책 조항 구조, Chain of Custody 형식 검증 |
| UX / UI Designer | 1 | 프로토타입, 디자인 시스템, 법무팀 공유 링크 UX |

---

## 7. Technical Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| YouTube API quota 초과 | High | API 계정 분산 수집; webhook 우선; 적극적 캐싱; 자동 failover |
| YouTube API 정책 변경으로 필드 제거 | High | Rule-engine-only fallback 모드 자동 전환; 점수에 `"provisional": true` 표시; ops 팀 알림 |
| GPT-4o 지연 / 비용 급증 | Medium | 반복 패턴 캐싱; 저위험 댓글 배치 처리; rule-engine-only 경로 fallback |
| 한국어 분류 정확도 | High | KoBERT 도메인 파인튜닝; rule engine override; 오분류 피드백 루프 |
| 오분류 (false positive / negative) | High | 인간 승인 게이트로 자동 실행 차단; 운영자 피드백 엔드포인트 → 리트레이닝 큐; 월간 정확도 감사 |
| 증거 파일 무결성 침해 | High | S3 Object Lock (Compliance Mode); KMS 암호화; 읽기 시마다 체크섬 검증 |
| 법무팀 공유 링크 남용 | Medium | 만료 토큰; 접근별 IP + timestamp 로깅; 이상 감지 시 자동 폐기 |
| Network Intelligence 재식별 | High | k-anonymity 임계값 (≥50채널); NetworkPattern에 PII 필드 없음; PIPA 법률 검토 후 출시 |
| 개인정보 처리 위반 | High | 데이터 최소화; PIPA 준수; 계약서 집계 데이터 활용 조항 명시 |
| 대규모 DDoS / API 남용 | Medium | 테넌트별 rate limiting; AWS WAF; Shield Standard (Phase 3) |

---

## 8. QA & Security Policy

### 8.1 Test Strategy

- **Unit tests:** Jest (frontend) + Pytest (Python services) — ≥80% coverage gate
- **Integration tests:** Supertest for API layer; DB transaction rollback validation
- **End-to-end tests:** Playwright — full flow: `collection → classification → Case 생성 → 승인 → PDF 생성 → 공유 링크 발급`
- **Load tests:** k6 — 100K comments/hour sustained; P99 response < 2s
- **분류 정확도 감사:** 확정된 법적 사건 대비 분류 결과 월간 검토; 분기별 임계값 재조정
- **Chain of custody 무결성 테스트:** Evidence Package 읽기 시 체크섬 자동 검증; 불일치 시 즉시 알림

### 8.2 Security Policy

- **Authentication:** OAuth 2.0 (Google Workspace SSO) + JWT; 모든 운영자 계정 MFA 강제
- **Authorization:** RBAC — Super Admin / Channel Manager / Viewer (3단계); Law Firm role — 읽기 전용, 증거 범위 한정, 링크 기반
- **Encryption in transit:** TLS 1.3 — 모든 엔드포인트 강제
- **Encryption at rest:** AES-256 (AWS KMS) — 모든 증거 파일 및 스냅샷
- **Evidence immutability:** S3 Object Lock Compliance Mode — 최소 30일, 재정의 불가
- **Law firm share link:** 만료 토큰; 접근 로그; 이상 감지 시 자동 폐기
- **Network Intelligence 보안:** k-anonymity 강제; 집계 저장소에 원본 댓글 없음; 구독자 데이터와 별도 경계
- **Penetration test:** GA 출시 전 외부 보안 업체 진행
- **OWASP Top 10:** MVP QA 게이트 조건으로 전체 체크리스트 통과 필수

---

*This document is confidential property of CommentGuard Inc. Unauthorized distribution is prohibited.*
*© 2025 CommentGuard Inc.*
