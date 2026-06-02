# CommentGuard — Development Plan
**Technical Roadmap & Sprint Breakdown**
Version 1.0 | June 2024 | Confidential

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

| | |
|---|---|
| **Architecture pattern** | Microservices — cloud-native, horizontally scalable |
| **Deployment** | Kubernetes (AWS EKS), multi-region (Seoul primary / Tokyo DR) |
| **Design principles** | API-First, Event-Driven, Evidence-Immutability |

### 1.1 Data Pipeline

```
① Platform APIs (YouTube / Instagram)  →  Collector Service
② Collector  →  Kafka topic: raw-comments  (immutable snapshot written here)
③ Kafka  →  Risk Classifier Service  (ML inference + rule engine)
④ Classifier  →  PostgreSQL (persistence) + Redis (real-time feed)
⑤ High-risk path  →  Evidence Service  →  S3 (AES-256 / Object Lock)
⑥ Web dashboard  →  BFF API  →  PostgreSQL / Redis query
```

### 1.2 Service Boundaries

| Service | Responsibility |
|---|---|
| Collector Service | Platform API integration, rate-limit management, immutable snapshot write |
| Risk Classifier Service | ML inference (GPT-4o + KoBERT) + rule engine; score computation |
| Evidence Service | PDF generation, S3 upload, KMS encryption, audit logging |
| Action Service | Platform API hide/delete execution after human approval; audit trail |
| Notification Service | Webhook, email, Slack alerts for high-risk events |
| Report Service | Brand Safety Report generation, campaign summary, shareable links |
| BFF API | Next.js backend-for-frontend; auth, data aggregation, SSE for real-time feed |

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

| Technology | Purpose | Rationale |
|---|---|---|
| Node.js + Fastify | API Gateway / BFF | High-throughput I/O; low latency |
| Python + FastAPI | Risk Classifier Service | ML library ecosystem; async-native |
| PostgreSQL 15 | Primary database | Complex queries; JSONB for flexible metadata |
| Redis 7 | Cache, sessions, pub/sub | Real-time comment feed; action state |
| Apache Kafka | Event streaming backbone | Durable, ordered comment pipeline |
| Elasticsearch | Full-text comment search | Keyword pattern detection; fast faceting |

### 2.3 AI / Machine Learning

| Technology | Purpose |
|---|---|
| OpenAI GPT-4o (API) | Contextual understanding; initial legal-type classification draft |
| KoBERT / KoELECTRA (fine-tuned) | Korean-language sentiment and intent classification |
| scikit-learn | Account anomaly detection (coordinated attack signals) |
| In-house Rule Engine | Legal statute keyword mapping; final score arbitration |

### 2.4 Infrastructure & DevOps

| Technology | Purpose |
|---|---|
| AWS EKS + Fargate | Container orchestration; auto-scaling |
| AWS S3 + Object Lock (WORM) | Evidence file storage — tamper-proof, 30-day minimum retention |
| AWS KMS | Encryption key management for evidence files |
| CloudFront | PDF / asset delivery CDN |
| GitHub Actions | CI/CD pipelines (lint → test → build → deploy) |
| Terraform | Infrastructure-as-Code; reproducible environments |
| Datadog | APM, logging, alerting, SLO tracking |
| AWS WAF + Shield Standard | DDoS protection; rate limiting |

---

## 3. Core Data Model

| Entity | Key Fields |
|---|---|
| Channel | `id`, `platform`, `platform_channel_id`, `mcn_id`, `api_credentials_ref`, `created_at` |
| Comment | `id`, `channel_id`, `platform_comment_id`, `text`, `author_id`, `created_at`, `snapshot_s3_key`, `snapshot_hash` |
| RiskAssessment | `comment_id`, `risk_types[]`, `legal_score`, `brand_score`, `urgency_score`, `recommended_action`, `model_version` |
| Action | `id`, `comment_id`, `action_type`, `approved_by`, `approved_at`, `executed_at`, `platform_response` |
| EvidencePackage | `id`, `comment_ids[]`, `pdf_s3_key`, `created_at`, `checksum`, `created_by` |
| Campaign | `id`, `brand_id`, `channel_ids[]`, `keyword_watch_list[]`, `start_at`, `end_at`, `brand_safety_score` |
| AccountPattern | `author_id`, `comment_count_30d`, `is_new_account`, `ip_cluster_id`, `flagged_at` |

---

## 4. Development Roadmap

| Phase | Duration | Goal | Key Deliverables |
|---|---|---|---|
| Phase 0 — Setup | 2 weeks | Team onboarding, dev environment | Monorepo, CI/CD, staging env |
| Phase 1 — MVP | 8 weeks | Core features operational | Collection, classification, dashboard, evidence PDF |
| Phase 2 — Beta | 8 weeks | 10 MCN beta customers live | Brand Safety Report, API hardening, billing alpha |
| Phase 3 — GA Launch | 4 weeks | General availability | Billing system, advertiser portal, public docs |
| Phase 4 — Scale | Ongoing | ML improvement, new platforms | TikTok, X (Twitter) integration; multi-language |

---

## 5. MVP Sprint Plan (Phase 1 — 8 Weeks)

### Sprint 1–2 (Weeks 1–2): Infrastructure & Collection

| Story | Owner | Points |
|---|---|---|
| AWS EKS cluster setup (Seoul region) | Infra | 8 |
| GitHub Actions CI/CD pipeline | Infra | 5 |
| PostgreSQL + Redis + Kafka initial setup | Backend | 8 |
| YouTube Data API v3 Collector Service | Backend | 13 |
| Immutable comment snapshot to S3 + KMS | Backend | 8 |
| Monorepo structure (Turborepo) setup | Full-stack | 3 |

### Sprint 3–4 (Weeks 3–4): Risk Classification Engine

| Story | Owner | Points |
|---|---|---|
| Rule-based classifier — legal statute keyword mapping | ML / Backend | 13 |
| GPT-4o API integration — contextual classification prompt engineering | ML | 13 |
| Legal / Brand / Urgency score computation logic | Backend | 8 |
| Account anomaly detection (recurrence, new-account flag) | ML | 8 |
| Persist classification results to PostgreSQL + Redis cache | Backend | 5 |

### Sprint 5–6 (Weeks 5–6): Dashboard & Action Workflow

| Story | Owner | Points |
|---|---|---|
| Next.js app setup + authentication (NextAuth.js + Google SSO) | Frontend | 8 |
| Dashboard home — risk cards, 7-day trend chart, type distribution | Frontend | 13 |
| Comment list + detail panel (scores, classification, legal reference) | Frontend | 13 |
| Action selection UI (Ignore / Hide / Delete / Preserve + Delete) + one-click approval | Frontend / Backend | 13 |
| Platform API hide / delete execution after approval | Backend | 8 |

### Sprint 7–8 (Weeks 7–8): Evidence Package & QA

| Story | Owner | Points |
|---|---|---|
| Evidence PDF generation service (text + metadata + screenshot + statutes) | Backend | 13 |
| Evidence vault UI + PDF download | Frontend | 8 |
| E2E tests (Playwright) — core flows, ≥80% coverage | QA | 13 |
| Load test (k6) — 100K comments/hour, P99 < 2s | Infra | 8 |
| OWASP Top 10 security checklist | Security | 8 |
| MVP acceptance testing + beta customer onboarding prep | PM | 5 |

---

## 6. Team Composition

| Role | Headcount | Responsibilities |
|---|---|---|
| Product Manager | 1 | Roadmap ownership, sprint management, customer interviews |
| Backend Engineer | 2 | API, Collector Service, Classifier integration, DB design |
| ML Engineer | 1 | Classification models, prompt engineering, scoring logic |
| Frontend Engineer | 2 | Dashboard, action workflow UI, report views |
| Infrastructure / DevOps | 1 | AWS, Kubernetes, CI/CD, security |
| Legal Advisor | 1 (part-time) | Risk classification criteria review, disclaimer structure |
| UX / UI Designer | 1 | Prototype, design system, usability validation |

---

## 7. Technical Risks & Mitigations

| Risk | Severity | Mitigation Strategy |
|---|---|---|
| YouTube API quota exhaustion | High | Multi-account distributed collection; webhook-first; aggressive caching |
| GPT-4o latency / cost spike | Medium | Cache repeated patterns; batch low-urgency; rule-engine-only path for low-risk |
| Korean language classification accuracy | High | KoBERT fine-tuning on domain data; rule engine override; human feedback loop |
| Evidence file integrity compromise | High | S3 Object Lock (Compliance Mode); KMS encryption; checksum verification on every read |
| Personal data processing violation | High | Data minimization; PIPA compliance; legal review of privacy policy |
| Large-scale DDoS / API abuse | Medium | Rate limiting per tenant; AWS WAF rules; Shield Standard |

---

## 8. QA & Security Policy

### 8.1 Test Strategy

- **Unit tests:** Jest (frontend) + Pytest (Python services) — ≥80% coverage gate
- **Integration tests:** Supertest for API layer; DB transaction rollback validation
- **End-to-end tests:** Playwright — full flow: `collection → classification → approval → PDF generation`
- **Load tests:** k6 — 100K comments/hour sustained; P99 response < 2 seconds

### 8.2 Security Policy

- **Authentication:** OAuth 2.0 (Google Workspace SSO) + JWT; MFA enforced for all operator accounts
- **Authorization:** RBAC — Super Admin / Channel Manager / Viewer (3 tiers)
- **Encryption in transit:** TLS 1.3 enforced on all endpoints
- **Encryption at rest:** AES-256 via AWS KMS for all evidence files and snapshots
- **Evidence immutability:** S3 Object Lock Compliance Mode — 30-day minimum, no override possible
- **Penetration test:** External security firm engagement before GA launch
- **OWASP Top 10:** Full checklist pass required as MVP QA gate condition

---

*This document is confidential property of CommentGuard Inc. Unauthorized distribution is prohibited.*
*© 2024 CommentGuard Inc.*
