# CommentGuard — Data Model

> CHECKLIST §5 requirement: every new entity must be documented here before the migration is merged.

---

## Immutability Rules

| Entity | Has `updatedAt` | Has UPDATE route | Notes |
|---|---|---|---|
| `Comment` | No | No | Immutable after ingest |
| `RiskAssessment` | No | No | Immutable classification result |
| `CustodyLog` | No | No | Append-only audit log |
| `EvidencePackage` | No | No | Immutable once generated |
| `ShareLinkAccess` | No | No | Immutable access log entry |
| `NetworkPattern` | No | No | Immutable aggregate snapshot |
| `Action` | Yes | Approval step only | Status transitions: PENDING → APPROVED → EXECUTED |
| `Case` | Yes | Status only | Lifecycle transitions only — see below |
| `User` | Yes | Profile only | OAuth identity — no password stored |
| `Channel` | Yes | Credentials ref | API credential rotation only |
| `Tenant` | Yes | Config only | Tenant settings |
| `ShareLink` | No | Revoke only | `isRevoked` flag via dedicated revoke endpoint |

---

## Entities

### Tenant
Multi-tenant isolation root. Every resource belongs to exactly one tenant.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `name` | String | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### User
OAuth identity only — no stored passwords. MFA enforced for operator roles.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `email` | String | Unique |
| `name` | String | |
| `role` | UserRole | SUPER_ADMIN / CHANNEL_MANAGER / VIEWER / LAW_FIRM |
| `tenantId` | FK Tenant | |
| `mfaEnabled` | Boolean | Must be true for operator accounts |
| `mfaSecret` | String? | TOTP secret — stored encrypted |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### Channel
A YouTube or Instagram channel being monitored.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `platform` | Platform | YOUTUBE / INSTAGRAM |
| `platformChannelId` | String | External ID from the platform |
| `name` | String | Display name |
| `tenantId` | FK Tenant | |
| `apiCredentialsRef` | String | Reference to secrets manager key — never store raw credentials here |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Unique: `(platform, platformChannelId)`

---

### Comment _(Immutable)_
Raw comment data captured at ingest. Never updated after creation.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `channelId` | FK Channel | |
| `platformCommentId` | String | External ID from the platform |
| `text` | String | Raw comment text |
| `authorPlatformId` | String | Platform author ID (not a user in our system) |
| `snapshotR2Key` | String | R2 object key of the raw snapshot |
| `snapshotHash` | String | SHA-256 of the snapshot content — stored separately from the file |
| `snapshotHashAlg` | String | Always `sha256` |
| `createdAt` | DateTime | Ingest timestamp |

Unique: `(channelId, platformCommentId)`

**Integrity rule**: `snapshotHash` must be verified on every read via `readAndVerifySnapshot()`. A mismatch is a critical integrity violation and must be logged and surfaced as an error.

---

### RiskAssessment _(Immutable)_
Classification result. One comment may have multiple assessments (e.g., re-runs after model update).

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `commentId` | FK Comment | |
| `riskTypes` | RiskType[] | Array: LEGAL_THREAT, HATE_SPEECH, HARASSMENT, SPAM, COORDINATED_ATTACK |
| `legalScore` | Float | 0.0–1.0 |
| `brandScore` | Float | 0.0–1.0 |
| `urgencyScore` | Float | 0.0–1.0 |
| `recommendedAction` | ActionType | IGNORE / HIDE / DELETE / PRESERVE_AND_DELETE |
| `modelVersion` | String | e.g. `gpt-4o-2024-05-13`, `rule-engine-v1` |
| `classification` | String | Always `"reference_only"` — never omit |
| `isProvisional` | Boolean | True when API schema fallback mode is active |
| `createdAt` | DateTime | |

---

### Action
Platform action (hide/delete) requiring human approval before execution.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `commentId` | FK Comment | |
| `actionType` | ActionType | |
| `status` | ActionStatus | PENDING → APPROVED → EXECUTED / FAILED |
| `approvedById` | FK User? | **Required before execution** — must be a real user, never system |
| `approvedAt` | DateTime? | Set at approval time alongside `approvedById` |
| `executedAt` | DateTime? | Set after successful platform API call |
| `platformResponse` | JSON? | Raw platform API response |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Rule**: `approvedById` must reference an existing User. Execution is blocked if `approvedById` is null.

---

### Case
Legal case grouping related comments and evidence packages.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `title` | String | |
| `status` | CaseStatus | Lifecycle — see transitions below |
| `createdById` | FK User | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Status lifecycle (no skipping, no reversal)**:
```
OPEN → UNDER_REVIEW → PACKAGED → REFERRED → CLOSED
```

---

### CustodyLog _(Append-only)_
Tamper-evident audit trail for a case. **No UPDATE or DELETE queries are permitted on this table.**

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `caseId` | FK Case | |
| `actorId` | FK User | Who performed the action |
| `action` | String | Action description, e.g. `STATUS_TRANSITION:OPEN→UNDER_REVIEW` |
| `ipAddress` | String | Caller IP |
| `metadata` | JSON? | Additional context |
| `createdAt` | DateTime | Immutable timestamp |

---

### EvidencePackage _(Immutable)_
Generated PDF evidence package. `caseId` is required — orphaned packages must not be created.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `caseId` | FK Case | **Required — no orphaned packages** |
| `pdfR2Key` | String | R2 object key of the PDF |
| `custodyLogR2Key` | String | R2 object key of the immutable custody log file |
| `checksum` | String | SHA-256 of the PDF binary |
| `checksumAlg` | String | Always `sha256` |
| `createdById` | String | User ID who triggered generation |
| `createdAt` | DateTime | |

**PDF must include**: incident timeline, chain of custody log, checksum block (hash + algorithm + timestamp), applicable legal statute references.

---

### ShareLink
Read-only access link for law firms. Token is cryptographic, expiry is required.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `caseId` | FK Case | |
| `token` | String | Unique. `crypto.randomBytes(32).toString('hex')` — never sequential |
| `expiresAt` | DateTime | **Required** — no non-expiring tokens |
| `isRevoked` | Boolean | Immediate effect on revocation |
| `revokedAt` | DateTime? | |
| `createdAt` | DateTime | |

**Anomaly rule**: auto-revoke if >10 accesses within 1 hour.

---

### ShareLinkAccess _(Immutable)_
Every access attempt is logged, including failed/expired ones.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `shareLinkId` | FK ShareLink | |
| `ipAddress` | String | |
| `userAgent` | String | |
| `accessedAt` | DateTime | |
| `wasValid` | Boolean | False if token expired or revoked |

---

### NetworkPattern _(Immutable, k-anonymous)_
Aggregate cross-channel pattern. **Must not contain any field that identifies a channel, author, subscriber, or MCN.**

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | PK |
| `patternType` | String | e.g. `coordinated_spam`, `keyword_surge` |
| `occurrenceCount` | Int | Total occurrences across channels |
| `distinctChannelCount` | Int | **Must be ≥ 50** (DB CHECK constraint + application guard) |
| `timeWindowStart` | DateTime | |
| `timeWindowEnd` | DateTime | |
| `metadata` | JSON? | Aggregate statistics only — no channel/author IDs |
| `createdAt` | DateTime | |

**Prohibited fields** (must never be added): `channel_id`, `author_id`, `mcn_id`, any field linking to a specific subscriber or commenter.

---

## Enums

| Enum | Values |
|---|---|
| `Platform` | YOUTUBE, INSTAGRAM |
| `CaseStatus` | OPEN, UNDER_REVIEW, PACKAGED, REFERRED, CLOSED |
| `ActionType` | IGNORE, HIDE, DELETE, PRESERVE_AND_DELETE |
| `ActionStatus` | PENDING, APPROVED, REJECTED, EXECUTED, FAILED |
| `UserRole` | SUPER_ADMIN, CHANNEL_MANAGER, VIEWER, LAW_FIRM |
| `RiskType` | LEGAL_THREAT, HATE_SPEECH, HARASSMENT, SPAM, COORDINATED_ATTACK |
