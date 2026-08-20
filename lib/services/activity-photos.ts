import { newId, touch } from "@/lib/data/ids";
import { getPilotStore } from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { getBlockDetail } from "@/lib/services/library";
import { canEditContentBlock } from "@/lib/services/permissions";
import { getActiveWorkspace } from "@/lib/services/projects";
import { toStorageObjectName } from "@/lib/storage-key";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ActivityPhoto } from "@/types/database";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"] as const;

function assertImageFilename(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!(IMAGE_EXT as readonly string[]).includes(ext)) {
    throw new Error("활동사진은 이미지 파일만 가능합니다. (png, jpg, jpeg, gif, webp)");
  }
  return ext;
}

async function assertCanEditVersion(contentVersionId: string) {
  const user = await getSessionUser();
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const version = store.content_versions.find((v) => v.id === contentVersionId);
    if (!version) throw new Error("콘텐츠 버전을 찾을 수 없습니다.");
    const block = store.content_blocks.find((b) => b.id === version.content_block_id);
    if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
    if (!canEditContentBlock(user, block)) {
      throw new Error("자기 부서에 지정된 컨텐츠만 활동사진을 첨부할 수 있습니다.");
    }
    return { user, version, block };
  }

  const admin = createSupabaseAdminClient();
  const { data: version, error } = await admin
    .from("content_versions")
    .select("*")
    .eq("id", contentVersionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!version) throw new Error("콘텐츠 버전을 찾을 수 없습니다.");

  const detail = await getBlockDetail(version.content_block_id);
  if (!detail) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
  if (!canEditContentBlock(user, detail.block)) {
    throw new Error("자기 부서에 지정된 컨텐츠만 활동사진을 첨부할 수 있습니다.");
  }
  return { user, version, block: detail.block };
}

export async function listActivityPhotosForVersion(
  contentVersionId: string,
): Promise<ActivityPhoto[]> {
  if (!isSupabaseConfigured()) {
    return getPilotStore()
      .activity_photos.filter((p) => p.content_version_id === contentVersionId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("activity_photos")
    .select("*")
    .eq("content_version_id", contentVersionId)
    .order("display_order");
  if (error) {
    if (/relation.*activity_photos.*does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ActivityPhoto[];
}

export async function listActivityPhotosForVersions(
  versionIds: string[],
): Promise<ActivityPhoto[]> {
  if (versionIds.length === 0) return [];
  if (!isSupabaseConfigured()) {
    return getPilotStore()
      .activity_photos.filter((p) => versionIds.includes(p.content_version_id))
      .sort((a, b) => a.display_order - b.display_order);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("activity_photos")
    .select("*")
    .in("content_version_id", versionIds)
    .order("display_order");
  if (error) {
    if (/relation.*activity_photos.*does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ActivityPhoto[];
}

export async function prepareActivityPhotoUpload(input: {
  filename: string;
  byteLength: number;
  content_version_id: string;
}) {
  await assertCanEditVersion(input.content_version_id);
  assertImageFilename(input.filename);
  if (input.byteLength <= 0) throw new Error("빈 파일입니다.");
  if (input.byteLength > 20 * 1024 * 1024) {
    throw new Error("활동사진은 20MB 이하여야 합니다.");
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase Storage가 필요합니다. NEXT_PUBLIC_SUPABASE_URL / keys를 확인하세요.",
    );
  }

  const workspace = await getActiveWorkspace();
  const photoId = newId();
  const safeName = toStorageObjectName(input.filename);
  const storagePath = `${workspace.company.id}/activity/${photoId}/${safeName}`;

  const admin = createSupabaseAdminClient();
  const { error: bucketErr } = await admin.storage.createBucket("evidences", {
    public: false,
    fileSizeLimit: 52428800,
  });
  if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
    // ignore
  }

  const { data, error } = await admin.storage
    .from("evidences")
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(
      error?.message ?? "활동사진 업로드 URL을 만들지 못했습니다.",
    );
  }

  return {
    photoId,
    storagePath: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function uploadActivityPhoto(input: {
  content_version_id: string;
  title: string;
  filename: string;
  storage_path: string;
  photo_id?: string;
}) {
  const { user } = await assertCanEditVersion(input.content_version_id);
  assertImageFilename(input.filename);
  const title = input.title.trim();
  if (!title) throw new Error("활동사진 제목을 입력하세요.");

  const ts = touch();
  const photoId = input.photo_id?.trim() || newId();

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const order =
      store.activity_photos.filter(
        (p) => p.content_version_id === input.content_version_id,
      ).length + 1;
    const photo: ActivityPhoto = {
      id: photoId,
      content_version_id: input.content_version_id,
      title,
      filename: input.filename,
      storage_path: input.storage_path,
      display_order: order,
      uploaded_by: user.id,
      created_at: ts,
      updated_at: ts,
    };
    store.activity_photos.push(photo);
    return photo;
  }

  const admin = createSupabaseAdminClient();
  const { error: signErr } = await admin.storage
    .from("evidences")
    .createSignedUrl(input.storage_path, 30);
  if (signErr) {
    throw new Error(
      signErr.message ||
        "Storage에서 활동사진을 찾지 못했습니다. 업로드 후 다시 시도하세요.",
    );
  }

  const { count } = await admin
    .from("activity_photos")
    .select("*", { count: "exact", head: true })
    .eq("content_version_id", input.content_version_id);

  const photo = {
    id: photoId,
    content_version_id: input.content_version_id,
    title,
    filename: input.filename,
    storage_path: input.storage_path,
    display_order: (count ?? 0) + 1,
    uploaded_by: user.id,
    created_at: ts,
    updated_at: ts,
  };

  const { error } = await admin.from("activity_photos").insert(photo);
  if (error) {
    if (/relation.*activity_photos.*does not exist/i.test(error.message)) {
      throw new Error(
        "activity_photos 테이블이 없습니다. supabase/migrations/20260820000000_activity_photos.sql 을 SQL Editor에서 실행하세요.",
      );
    }
    throw new Error(error.message);
  }

  await writeAuditLog({
    action: "CREATE",
    entity_type: "activity_photos",
    entity_id: photoId,
    before_data: null,
    after_data: photo,
  });

  return photo as ActivityPhoto;
}

export async function updateActivityPhotoTitle(
  photoId: string,
  title: string,
) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("활동사진 제목을 입력하세요.");

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const photo = store.activity_photos.find((p) => p.id === photoId);
    if (!photo) throw new Error("활동사진을 찾을 수 없습니다.");
    await assertCanEditVersion(photo.content_version_id);
    photo.title = trimmed;
    photo.updated_at = touch();
    return photo;
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error } = await admin
    .from("activity_photos")
    .select("*")
    .eq("id", photoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!existing) throw new Error("활동사진을 찾을 수 없습니다.");
  await assertCanEditVersion(existing.content_version_id);

  const ts = touch();
  const { data, error: uErr } = await admin
    .from("activity_photos")
    .update({ title: trimmed, updated_at: ts })
    .eq("id", photoId)
    .select("*")
    .single();
  if (uErr) throw new Error(uErr.message);
  return data as ActivityPhoto;
}

export async function deleteActivityPhoto(photoId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const photo = store.activity_photos.find((p) => p.id === photoId);
    if (!photo) throw new Error("활동사진을 찾을 수 없습니다.");
    await assertCanEditVersion(photo.content_version_id);
    store.activity_photos = store.activity_photos.filter((p) => p.id !== photoId);
    return { ok: true as const };
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error } = await admin
    .from("activity_photos")
    .select("*")
    .eq("id", photoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!existing) throw new Error("활동사진을 찾을 수 없습니다.");
  await assertCanEditVersion(existing.content_version_id);

  const { error: dErr } = await admin
    .from("activity_photos")
    .delete()
    .eq("id", photoId);
  if (dErr) throw new Error(dErr.message);

  await admin.storage.from("evidences").remove([existing.storage_path]);

  await writeAuditLog({
    action: "DELETE",
    entity_type: "activity_photos",
    entity_id: photoId,
    before_data: existing,
    after_data: null,
  });

  return { ok: true as const };
}

export async function createActivityPhotoSignedUrl(storagePath: string) {
  await getSessionUser();
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되지 않았습니다.");
  }
  const path = storagePath.trim();
  if (!path || path.includes("..")) {
    throw new Error("storage_path가 필요합니다.");
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("evidences")
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "서명 URL을 만들지 못했습니다.");
  }
  return { url: data.signedUrl };
}
