// API response types shared across services

export interface RiskScoreResponse {
  commentId: string;
  legalScore: number;
  brandScore: number;
  urgencyScore: number;
  recommendedAction: "REQUEST_LEGAL_REVIEW" | null;
  riskTypes: string[];
  modelVersion: string;
  // CHECKLIST §3: must always be present
  classification: "reference_only";
  isProvisional: boolean;
}

export interface ActionApprovalRequest {
  actionId: string;
  // CHECKLIST §3: approvedBy must be a real user ID, never system/bot
  approvedById: string;
}

export interface ShareLinkCreateRequest {
  caseId: string;
  // CHECKLIST §4: expiresAt is required - no non-expiring tokens
  expiresAt: Date;
}

export interface CustodyLogEntry {
  caseId: string;
  actorId: string;
  action: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
}

export interface EvidencePackageCreateRequest {
  // CHECKLIST §2: case_id required - no orphaned packages
  caseId: string;
  commentIds: string[];
}
