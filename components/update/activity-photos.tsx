"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actionDeleteActivityPhoto,
  actionUpdateActivityPhotoTitle,
  actionUploadActivityPhoto,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActivityPhoto } from "@/types/database";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];

export function ActivityPhotosEditor({
  contentVersionId,
  photos,
  canEdit,
}: {
  contentVersionId: string | null | undefined;
  photos: ActivityPhoto[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  if (!contentVersionId) return null;

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setTitle("");
        setFile(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "요청 실패");
      }
    });
  }

  return (
    <section className="rounded-lg border bg-white p-3">
      <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
        활동사진
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        증빙(감사 근거)과 별도로, 보고서에 실릴 일반 활동 이미지를 첨부합니다.
        각 사진에 제목을 넣으면 Report Draft에 함께 표시됩니다.
      </p>

      {photos.length > 0 ? (
        <ul className="mb-3 space-y-3">
          {photos.map((photo) => (
            <ActivityPhotoRow
              key={photo.id}
              photo={photo}
              canEdit={canEdit}
              pending={pending}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">첨부된 활동사진 없음</p>
      )}

      {canEdit ? (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">사진 제목</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2027 협력사 인권교육 현장"
            />
          </label>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            disabled={pending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            size="sm"
            disabled={pending || !file || !title.trim()}
            onClick={() => {
              if (!file) return;
              const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
              if (!IMAGE_EXT.includes(ext)) {
                setError("이미지 파일만 첨부할 수 있습니다.");
                return;
              }
              run(async () => {
                const prepRes = await fetch("/api/activity-photos/prepare", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    filename: file.name,
                    byteLength: file.size,
                    content_version_id: contentVersionId,
                  }),
                });
                const prep = (await prepRes.json()) as {
                  error?: string;
                  storagePath?: string;
                  token?: string;
                  photoId?: string;
                };
                if (!prepRes.ok || !prep.storagePath || !prep.token) {
                  throw new Error(prep.error ?? "업로드 준비 실패");
                }
                const { createSupabaseBrowserClient } = await import(
                  "@/lib/supabase/client"
                );
                const supabase = createSupabaseBrowserClient();
                const { error: upErr } = await supabase.storage
                  .from("evidences")
                  .uploadToSignedUrl(prep.storagePath, prep.token, file);
                if (upErr) throw new Error(upErr.message || "Storage 업로드 실패");

                await actionUploadActivityPhoto({
                  content_version_id: contentVersionId,
                  title: title.trim(),
                  filename: file.name,
                  storage_path: prep.storagePath,
                  photo_id: prep.photoId,
                });
              });
            }}
          >
            활동사진 추가
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

function ActivityPhotoRow({
  photo,
  canEdit,
  pending,
  onError,
}: {
  photo: ActivityPhoto;
  canEdit: boolean;
  pending: boolean;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(photo.title);
  const [localPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/activity-photos/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storage_path: photo.storage_path }),
        });
        const data = (await res.json()) as { url?: string };
        if (!cancelled && data.url) setUrl(data.url);
      } catch {
        // preview optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photo.storage_path]);

  useEffect(() => {
    setEditTitle(photo.title);
  }, [photo.title]);

  return (
    <li className="flex flex-wrap gap-3 rounded-md border bg-slate-50 p-2">
      <div className="h-24 w-32 overflow-hidden rounded bg-slate-200">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={photo.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            미리보기
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {canEdit ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => {
              if (editTitle.trim() === photo.title) return;
              onError(null);
              startTransition(async () => {
                try {
                  await actionUpdateActivityPhotoTitle(photo.id, editTitle);
                  router.refresh();
                } catch (e) {
                  onError(e instanceof Error ? e.message : "제목 저장 실패");
                  setEditTitle(photo.title);
                }
              });
            }}
          />
        ) : (
          <p className="text-sm font-medium">{photo.title}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{photo.filename}</p>
        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending || localPending}
            onClick={() => {
              onError(null);
              startTransition(async () => {
                try {
                  await actionDeleteActivityPhoto(photo.id);
                  router.refresh();
                } catch (e) {
                  onError(e instanceof Error ? e.message : "삭제 실패");
                }
              });
            }}
          >
            삭제
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Read-only gallery for Report Draft / Library. */
export function ActivityPhotosGallery({
  photos,
}: {
  photos: Array<ActivityPhoto & { url?: string | null }>;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="mt-5 space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-navy)]">
        활동사진
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <figure key={photo.id} className="space-y-1.5">
            <div className="overflow-hidden rounded-md border bg-slate-100">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="max-h-72 w-full object-contain"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                  이미지를 불러올 수 없습니다
                </div>
              )}
            </div>
            <figcaption className="text-sm text-[var(--brand-ink)]">
              {photo.title}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
