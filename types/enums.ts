export const USER_ROLES = ["ADMIN", "CONTRIBUTOR", "REVIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ISSUE_CATEGORIES = [
  "ENVIRONMENTAL",
  "SOCIAL",
  "GOVERNANCE",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const CONTENT_TYPES = [
  "POLICY",
  "GOVERNANCE",
  "STRATEGY",
  "RISK_OPPORTUNITY",
  "TARGET",
  "ACTIVITY",
  "PERFORMANCE",
  "PROCESS",
  "CERTIFICATION",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const UPDATE_TYPES = [
  "NARRATIVE",
  "STRUCTURE",
  "ACTIVITY",
  "NUMERIC",
  "TARGET",
  "CERTIFICATION",
] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

export const CONTENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "ARCHIVED",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CHANGE_TYPES = [
  "PENDING",
  "NO_CHANGE",
  "MODIFIED",
  "NEW",
  "DELETED",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const KEY_FACT_VALUE_TYPES = [
  "TEXT",
  "NUMBER",
  "FREQUENCY",
  "PERCENT",
  "SCORE",
] as const;
export type KeyFactValueType = (typeof KEY_FACT_VALUE_TYPES)[number];

export const EVIDENCE_RELATIONSHIP_TYPES = [
  "PRIMARY",
  "SUPPORTING",
  "REFERENCE",
] as const;
export type EvidenceRelationshipType =
  (typeof EVIDENCE_RELATIONSHIP_TYPES)[number];

export const REVIEW_ACTIONS = [
  "START_REVIEW",
  "APPROVE",
  "REQUEST_REVISION",
  "COMMENT",
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export const AI_SUGGESTION_TYPES = [
  "CHANGE_SUMMARY",
  "NARRATIVE_UPDATE",
  "EVIDENCE_CHECK",
] as const;
export type AiSuggestionType = (typeof AI_SUGGESTION_TYPES)[number];

export const AI_SUGGESTION_STATUSES = [
  "PENDING",
  "APPLIED",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type AiSuggestionStatus = (typeof AI_SUGGESTION_STATUSES)[number];

export const EXTRACTION_JOB_STATUSES = [
  "PENDING",
  "PROCESSING",
  "REVIEW_REQUIRED",
  "COMPLETED",
  "FAILED",
] as const;
export type ExtractionJobStatus = (typeof EXTRACTION_JOB_STATUSES)[number];
