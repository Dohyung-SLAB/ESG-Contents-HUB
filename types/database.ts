import type {
  AiSuggestionStatus,
  AiSuggestionType,
  ChangeType,
  ContentStatus,
  ContentType,
  EvidenceRelationshipType,
  ExtractionJobStatus,
  IssueCategory,
  KeyFactValueType,
  ProjectStatus,
  ReviewAction,
  UpdateType,
  UserRole,
} from "@/types/enums";

/** JSON object stored on content_blocks.form_schema */
export type FormSchema = Record<string, unknown>;

/** JSON payload stored on ai_suggestions.payload */
export type AiSuggestionPayload = Record<string, unknown>;

/** JSON array stored on extraction_candidates.key_facts */
export type ExtractionKeyFact = {
  key: string;
  value_text?: string | null;
  value_number?: number | null;
  unit?: string | null;
  value_type?: KeyFactValueType | null;
};

export type Company = {
  id: string;
  name: string;
  brand_primary: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  company_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  department: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  company_id: string;
  name: string;
  reporting_year: number;
  base_year: number | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type Issue = {
  id: string;
  project_id: string;
  name: string;
  category: IssueCategory;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type ContentBlock = {
  id: string;
  issue_id: string;
  parent_block_id: string | null;
  code: string;
  section: string | null;
  sub_topic: string | null;
  title: string;
  content_type: ContentType;
  update_type: UpdateType;
  owner_department: string | null;
  owner_user_id: string | null;
  reviewer_user_id: string | null;
  form_schema: FormSchema;
  display_order: number;
  is_active: boolean;
  /** Human-selected ESG evaluation frameworks (KCGS/MSCI/DJSI) */
  esg_frameworks: string[];
  /** Human-selected disclosure frameworks (KSSB/GRI/SASB) */
  disclosure_frameworks: string[];
  created_at: string;
  updated_at: string;
};

export type ContentVersion = {
  id: string;
  content_block_id: string;
  reporting_year: number;
  previous_version_id: string | null;
  narrative: string | null;
  change_type: ChangeType;
  change_summary: string | null;
  status: ContentStatus;
  source_document: string | null;
  source_page: number | null;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

export type KeyFact = {
  id: string;
  content_version_id: string;
  key: string;
  value_text: string | null;
  value_number: number | null;
  unit: string | null;
  value_type: KeyFactValueType;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type Evidence = {
  id: string;
  company_id: string;
  filename: string;
  document_type: string | null;
  reporting_year: number | null;
  department: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Report-facing activity images (not proof/evidence files). */
export type ActivityPhoto = {
  id: string;
  content_version_id: string;
  title: string;
  filename: string;
  storage_path: string;
  display_order: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentEvidence = {
  id: string;
  content_version_id: string;
  evidence_id: string;
  relationship_type: EvidenceRelationshipType;
  created_at: string;
};

export type Review = {
  id: string;
  content_version_id: string;
  reviewer_id: string;
  action: ReviewAction;
  comment: string | null;
  created_at: string;
};

export type AiSuggestion = {
  id: string;
  content_version_id: string;
  suggestion_type: AiSuggestionType;
  status: AiSuggestionStatus;
  payload: AiSuggestionPayload;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  profile_id: string;
  member_role: UserRole;
  created_at: string;
  updated_at: string;
};

export type ProjectInvite = {
  id: string;
  project_id: string;
  email: string;
  member_role: UserRole;
  department: string | null;
  invited_by: string | null;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
};

export type ExtractionJob = {
  id: string;
  project_id: string;
  storage_path: string;
  original_filename: string;
  toc_section: string | null;
  status: ExtractionJobStatus;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ExtractionCandidate = {
  id: string;
  job_id: string;
  title: string;
  section: string | null;
  sub_topic: string | null;
  content_type: ContentType | null;
  update_type: UpdateType | null;
  narrative: string | null;
  key_facts: ExtractionKeyFact[];
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
  display_order: number;
  /** Human-selected ESG evaluation frameworks (KCGS/MSCI/DJSI) */
  esg_frameworks: string[];
  /** Human-selected disclosure frameworks (KSSB/GRI/SASB) */
  disclosure_frameworks: string[];
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};
