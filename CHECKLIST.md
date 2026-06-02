# CommentGuard — Development Checklist

> Claude Code: Run through the relevant section(s) before every commit or PR.
> If any item fails, fix it before proceeding.

---

## 0. Before Writing Any Code

- [x] Have you read `CLAUDE.md`?
- [x] Have you read `DESIGN.md`?
- [ ] Is the feature in scope for the **current sprint**? (check `CLAUDE.md` § Current Phase)

---

## 1. Evidence Integrity

> Applies to: Collector Service, Evidence Service, any code that touches S3 or EvidencePackage

- [x] Snapshot is written to S3 **before** any classification or action runs
- [x] SHA-256 hash is computed at ingest and stored **separately** from the file
- [x] Hash is verified on every read (not just on write)
- [x] S3 bucket has Object Lock (WORM, Compliance Mode) — never use Governance Mode for evidence buckets
- [x] Minimum retention is set to 30 days — no code path can override this
- [x] EvidencePackage PDF includes:
  - [x] Incident timeline page
  - [x] Chain of custody log page
  - [x] Checksum block (hash + algorithm + timestamp)
  - [x] Applicable legal statute references

---

## 2. Chain of Custody

> Applies to: Evidence Service, Case Management Service, any audit log writes

- [x] Custody log is **append-only** — no `UPDATE` or `DELETE` queries exist on `custody_log`
- [x] Every custody log entry contains: `actor_id`, `action`, `timestamp`, `ip_address`
- [x] Case status transitions follow the defined lifecycle only:
  `Open → UnderReview → Packaged → Referred → Closed`
  No skipping steps. No reverse transitions.
- [x] EvidencePackage has `case_id` set — orphaned packages (no case link) should not be created

---

## 3. Action Workflow — No Auto-Delete

> Applies to: Action Service, any endpoint that calls platform hide/delete APIs

- [x] **No code path executes a platform action without `approved_by` being set**
- [x] `approved_by` field is a real user ID — never a system/bot ID
- [x] `approved_at` timestamp is recorded alongside `approved_by`
- [x] API response for risk scores includes the disclaimer label:
  `"classification": "reference_only"` (never omit this field)
- [x] No scheduled job or background worker can trigger platform actions autonomously

---

## 4. Law Firm Share Link

> Applies to: Case Management Service, any endpoint under `/share-links`

- [x] Share link endpoints are **read-only** — only `GET` methods allowed
- [x] Token is a cryptographic hash — never a sequential ID or guessable string
- [x] `expires_at` is always set — no non-expiring tokens
- [x] Every access (even failed attempts) is logged: `ip`, `user_agent`, `accessed_at`
- [x] Anomaly detection threshold is configured (e.g., >10 accesses/hour → auto-revoke)
- [x] Link revocation works immediately — no cache delay on invalidation

---

## 5. Data Model

> Applies to: any migration or schema change

- [x] New migration file created — existing migrations are **never modified**
- [x] All new entities have `created_at`
- [x] Immutable records (Evidence, CustodyLog, Snapshot) have **no** `updated_at` and **no** `UPDATE` routes
- [x] `NetworkPattern` entity does **not** contain any of:
  - `channel_id`
  - `author_id`
  - `mcn_id`
  - Any field that could identify a subscriber or commenter
- [x] k-anonymity threshold enforced: a pattern is only written when derived from ≥ 50 distinct channels
- [x] New entity added to `docs/DATA_MODEL.md` before the migration is merged

---

## 6. API Design

> Applies to: all new or modified endpoints

- [x] Endpoint follows REST conventions — resource nouns, correct HTTP verbs
- [x] Auth required on all endpoints — no unprotected routes except `/health`
- [x] RBAC role checked:
  - Super Admin / Channel Manager / Viewer for operator routes
  - Law Firm role for share link routes (read-only, evidence-scoped)
- [x] Rate limiting configured per tenant — not globally
- [x] Response never includes raw comment data outside the subscriber's own scope
- [x] Error responses do not leak internal stack traces or DB details

---

## 7. Network Intelligence Service

> Applies to: anonymization pipeline, NetworkPattern writes, aggregate API

- [x] Raw comment content is **never** written to the aggregate store
- [x] De-identification runs before any cross-channel computation
- [x] Output of aggregation is verified to contain no channel-level or author-level fields
- [x] Aggregate is only surfaced via the Network Intelligence API — never directly from the DB
- [ ] PIPA compliance check completed if adding a new field to the aggregate pipeline

---

## 8. Platform API (YouTube / Instagram)

> Applies to: Collector Service, any platform API call

- [x] All calls are within official API permissions — no scraping
- [x] Quota usage is tracked per API credential account
- [x] Fallback to rule-engine-only mode is implemented if API response schema changes
  (scores flagged as `"provisional": true` in fallback mode)
- [x] API policy change detection: if required fields are missing from response → alert ops, do not silently fail

---

## 9. Classification & ML

> Applies to: Risk Classifier Service, rule engine, scoring logic

- [x] Misclassification correction endpoint exists and routes to the retraining queue
- [x] Model version is stored with every `RiskAssessment` record (`model_version` field)
- [x] Rule engine override path is functional — ML score can be overridden by rule engine for legal statute keywords
- [x] No classification result is surfaced as a legal determination — always labeled as reference only
- [x] Monthly accuracy audit query exists (confirmed legal cases vs. classification result at time of incident)

---

## 10. Security

> Applies to: all code, but especially auth, encryption, and external-facing endpoints

- [x] TLS 1.3 enforced — no fallback to older TLS versions
- [x] All evidence files and snapshots encrypted at rest via AWS KMS (AES-256)
- [x] MFA enforced for all operator accounts — no bypass path in code
- [x] No secrets, API keys, or credentials in source code or logs
- [ ] OWASP Top 10 checklist reviewed for any new external-facing endpoint

---

## 11. Tests

> Applies to: all PRs

- [x] Unit test coverage ≥ 80% for changed files
- [ ] Integration test covers the full flow for any new service interaction
- [ ] E2E test updated if a user-facing flow changed:
  `collection → classification → Case creation → approval → PDF generation → share link`
- [ ] Load test baseline is not regressed (P99 < 2s at 100K comments/hour)
- [x] New custody log / chain of custody path has a dedicated integrity test

---

## 12. PR Description

- [ ] PR description states which sprint story this closes
- [ ] If a DECISION was made during this PR (e.g., chose approach A over B), it is added to `docs/DECISIONS.md`
- [ ] If a new "never do X" rule emerged, it is added to this `CHECKLIST.md`
- [ ] `CLAUDE.md` § Current Phase updated if a sprint story is now complete

---

> **Rule:** If you are unsure whether a checklist item applies, assume it does.
> The cost of a false positive check is zero. The cost of a missed evidence integrity bug is a failed legal case.
