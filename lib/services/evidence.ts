import { newId, touch } from "@/lib/data/ids";
import {
  getCurrentUser as getPilotCurrentUser,
  getPilotStore,
} from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { getActiveWorkspace } from "@/lib/services/projects";
import { toStorageObjectName } from "@/lib/storage-key";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { EvidenceRelationshipType } from "@/types/enums";

const ALLOWED_EXT = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
];

export async function listEvidences() {
  if (!isSupabaseConfigured()) {
    return listEvidencesPilot();
  }

  const admin = createSupabaseAdminClient();
  const [
    { data: evidences, error },
    { data: links },
    { data: versions },
    { data: blocks },
    { data: profiles },
  ] = await Promise.all([
    admin.from("evidences").select("*").order("created_at", { ascending: false }),
    admin.from("content_evidences").select("*"),
    admin.from("content_versions").select("id,content_block_id"),
    admin.from("content_blocks").select("id,code,title"),
    admin.from("profiles").select("id,full_name"),
  ]);
  if (error) throw new Error(error.message);

  const versionMap = new Map((versions ?? []).map((v) => [v.id, v]));
  const blockMap = new Map((blocks ?? []).map((b) => [b.id, b]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (evidences ?? []).map((e) => {
    const eLinks = (links ?? []).filter((ce) => ce.evidence_id === e.id);
    const linkedBlocks = eLinks.map((link) => {
      const version = versionMap.get(link.content_version_id);
      const block = version ? blockMap.get(version.content_block_id) : null;
      return {
        link,
        block_code: block?.code ?? null,
        block_title: block?.title ?? null,
        version_id: link.content_version_id,
      };
    });
    return {
      ...e,
      uploaded_by_name: e.uploaded_by
        ? (profileMap.get(e.uploaded_by)?.full_name ?? null)
        : null,
      linked_blocks: linkedBlocks,
    };
  });
}

function listEvidencesPilot() {
  const store = getPilotStore();
  return store.evidences
    .map((e) => {
      const links = store.content_evidences.filter((ce) => ce.evidence_id === e.id);
      const linkedBlocks = links.map((link) => {
        const version = store.content_versions.find(
          (v) => v.id === link.content_version_id,
        );
        const block = version
          ? store.content_blocks.find((b) => b.id === version.content_block_id)
          : null;
        return {
          link,
          block_code: block?.code ?? null,
          block_title: block?.title ?? null,
          version_id: link.content_version_id,
        };
      });
      const uploader = store.profiles.find((p) => p.id === e.uploaded_by);
      return {
        ...e,
        uploaded_by_name: uploader?.full_name ?? null,
        linked_blocks: linkedBlocks,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function prepareEvidenceUpload(input: {
  filename: string;
  byteLength: number;
  content_version_id: string;
}) {
  const user = await getSessionUser();
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error(`지원하지 않는 파일 형식입니다: .${ext}`);
  }
  if (input.byteLength <= 0) throw new Error("빈 파일입니다.");
  if (input.byteLength > 50 * 1024 * 1024) {
    throw new Error("Evidence 파일은 50MB 이하여야 합니다.");
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase Storage가 필요합니다. NEXT_PUBLIC_SUPABASE_URL / keys를 확인하세요.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: version, error: vErr } = await admin
    .from("content_versions")
    .select("id")
    .eq("id", input.content_version_id)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) throw new Error("콘텐츠 버전을 찾을 수 없습니다.");

  const workspace = await getActiveWorkspace();
  const evidenceId = newId();
  const safeName = toStorageObjectName(input.filename);
  const storagePath = `${workspace.company.id}/${evidenceId}/${safeName}`;

  const { error: bucketErr } = await admin.storage.createBucket("evidences", {
    public: false,
    fileSizeLimit: 52428800,
  });
  if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
    // ignore missing-bucket race; signed URL will surface real errors
  }

  const { data, error } = await admin.storage
    .from("evidences")
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(
      error?.message ??
        "Evidence 업로드 URL을 만들지 못했습니다. evidences 버킷을 확인하세요.",
    );
  }

  return {
    evidenceId,
    storagePath: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function uploadEvidence(input: {
  filename: string;
  document_type?: string;
  reporting_year?: number;
  department?: string;
  content_version_id: string;
  relationship_type?: EvidenceRelationshipType;
  /** Required when Supabase is configured — file must already be in Storage. */
  storage_path?: string;
  /** Optional pre-allocated id from prepareEvidenceUpload */
  evidence_id?: string;
}) {
  if (!isSupabaseConfigured()) {
    return uploadEvidencePilot(input);
  }

  const user = await getSessionUser();
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error(`지원하지 않는 파일 형식입니다: .${ext}`);
  }
  const storagePath = input.storage_path?.trim();
  if (!storagePath) {
    throw new Error(
      "storage_path가 필요합니다. 브라우저에서 Evidence를 Storage로 먼저 업로드하세요.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: version, error: vErr } = await admin
    .from("content_versions")
    .select("*")
    .eq("id", input.content_version_id)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) throw new Error("콘텐츠 버전을 찾을 수 없습니다.");

  // Verify object exists in Storage (metadata-only registration).
  const { error: signErr } = await admin.storage
    .from("evidences")
    .createSignedUrl(storagePath, 30);
  if (signErr) {
    throw new Error(
      signErr.message ||
        "Storage에서 Evidence 파일을 찾지 못했습니다. 업로드 후 다시 시도하세요.",
    );
  }

  const workspace = await getActiveWorkspace();
  const ts = touch();
  const evidenceId = input.evidence_id?.trim() || newId();
  const evidence = {
    id: evidenceId,
    company_id: workspace.company.id,
    filename: input.filename,
    document_type: input.document_type ?? ext.toUpperCase(),
    reporting_year: input.reporting_year ?? version.reporting_year,
    department: input.department ?? user.department,
    storage_path: storagePath,
    uploaded_by: user.id,
    created_at: ts,
    updated_at: ts,
  };

  const { error: eErr } = await admin.from("evidences").insert(evidence);
  if (eErr) throw new Error(eErr.message);

  const link = {
    id: newId(),
    content_version_id: input.content_version_id,
    evidence_id: evidenceId,
    relationship_type: input.relationship_type ?? ("SUPPORTING" as const),
    created_at: ts,
  };
  const { error: lErr } = await admin.from("content_evidences").insert(link);
  if (lErr) throw new Error(lErr.message);

  await writeAuditLog({
    action: "EVIDENCE_UPLOAD",
    entity_type: "evidences",
    entity_id: evidenceId,
    before_data: null,
    after_data: { evidence, link },
  });

  return { evidence, link };
}

function uploadEvidencePilot(input: {
  filename: string;
  document_type?: string;
  reporting_year?: number;
  department?: string;
  content_version_id: string;
  relationship_type?: EvidenceRelationshipType;
  storage_path?: string;
}) {
  const store = getPilotStore();
  const user = getPilotCurrentUser();
  const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error(`지원하지 않는 파일 형식입니다: .${ext}`);
  }
  const version = store.content_versions.find(
    (v) => v.id === input.content_version_id,
  );
  if (!version) throw new Error("콘텐츠 버전을 찾을 수 없습니다.");
  const companyId =
    store.companies.find((c) => c.id === store.projects.find((p) => p.id === store.active_project_id)?.company_id)?.id ??
    store.companies[0]?.id;
  const ts = touch();
  const evidenceId = newId();
  const evidence = {
    id: evidenceId,
    company_id: companyId,
    filename: input.filename,
    document_type: input.document_type ?? ext.toUpperCase(),
    reporting_year: input.reporting_year ?? version.reporting_year,
    department: input.department ?? user.department,
    storage_path:
      input.storage_path ??
      `pilot/${companyId}/${evidenceId}/${input.filename}`,
    uploaded_by: user.id,
    created_at: ts,
    updated_at: ts,
  };
  store.evidences.push(evidence);
  const link = {
    id: newId(),
    content_version_id: input.content_version_id,
    evidence_id: evidenceId,
    relationship_type: input.relationship_type ?? ("SUPPORTING" as const),
    created_at: ts,
  };
  store.content_evidences.push(link);
  void writeAuditLog({
    action: "EVIDENCE_UPLOAD",
    entity_type: "evidences",
    entity_id: evidenceId,
    before_data: null,
    after_data: { evidence, link },
  });
  return { evidence, link };
}

export async function linkEvidence(input: {
  evidence_id: string;
  content_version_id: string;
  relationship_type?: EvidenceRelationshipType;
}) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const exists = store.content_evidences.find(
      (ce) =>
        ce.evidence_id === input.evidence_id &&
        ce.content_version_id === input.content_version_id,
    );
    if (exists) return exists;
    const link = {
      id: newId(),
      content_version_id: input.content_version_id,
      evidence_id: input.evidence_id,
      relationship_type: input.relationship_type ?? ("SUPPORTING" as const),
      created_at: touch(),
    };
    store.content_evidences.push(link);
    return link;
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("content_evidences")
    .select("*")
    .eq("evidence_id", input.evidence_id)
    .eq("content_version_id", input.content_version_id)
    .maybeSingle();
  if (existing) return existing;

  const link = {
    id: newId(),
    content_version_id: input.content_version_id,
    evidence_id: input.evidence_id,
    relationship_type: input.relationship_type ?? ("SUPPORTING" as const),
    created_at: touch(),
  };
  const { data, error } = await admin
    .from("content_evidences")
    .insert(link)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function unlinkEvidence(contentEvidenceId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const idx = store.content_evidences.findIndex(
      (ce) => ce.id === contentEvidenceId,
    );
    if (idx < 0) throw new Error("연결을 찾을 수 없습니다.");
    const [removed] = store.content_evidences.splice(idx, 1);
    void writeAuditLog({
      action: "EVIDENCE_UNLINK",
      entity_type: "content_evidences",
      entity_id: removed.id,
      before_data: removed,
      after_data: null,
    });
    return removed;
  }

  const admin = createSupabaseAdminClient();
  const { data: removed, error: fErr } = await admin
    .from("content_evidences")
    .select("*")
    .eq("id", contentEvidenceId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  if (!removed) throw new Error("연결을 찾을 수 없습니다.");
  const { error } = await admin
    .from("content_evidences")
    .delete()
    .eq("id", contentEvidenceId);
  if (error) throw new Error(error.message);
  await writeAuditLog({
    action: "EVIDENCE_UNLINK",
    entity_type: "content_evidences",
    entity_id: removed.id,
    before_data: removed,
    after_data: null,
  });
  return removed;
}

export async function deleteEvidence(evidenceId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const user = getPilotCurrentUser();
    if (user.role !== "ADMIN") {
      throw new Error("Evidence 삭제는 ADMIN만 가능합니다.");
    }
    const evidence = store.evidences.find((e) => e.id === evidenceId);
    if (!evidence) throw new Error("Evidence를 찾을 수 없습니다.");
    store.content_evidences = store.content_evidences.filter(
      (ce) => ce.evidence_id !== evidenceId,
    );
    store.evidences = store.evidences.filter((e) => e.id !== evidenceId);
    void writeAuditLog({
      action: "DELETE",
      entity_type: "evidences",
      entity_id: evidenceId,
      before_data: evidence,
      after_data: null,
    });
    return evidence;
  }

  const user = await getSessionUser();
  if (user.role !== "ADMIN") {
    throw new Error("Evidence 삭제는 ADMIN만 가능합니다.");
  }
  const admin = createSupabaseAdminClient();
  const { data: evidence, error: fErr } = await admin
    .from("evidences")
    .select("*")
    .eq("id", evidenceId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  if (!evidence) throw new Error("Evidence를 찾을 수 없습니다.");

  await admin.from("content_evidences").delete().eq("evidence_id", evidenceId);
  const { error } = await admin.from("evidences").delete().eq("id", evidenceId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "DELETE",
    entity_type: "evidences",
    entity_id: evidenceId,
    before_data: evidence,
    after_data: null,
  });
  return evidence;
}
