"use client";

import { useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReportDraftDownloadButton({
  approvedOnly,
}: {
  approvedOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={cn(buttonVariants(), "text-sm")}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await fetch(
                `/api/report-draft${approvedOnly ? "?approvedOnly=1" : ""}`,
              );
              const data = (await res.json()) as {
                error?: string;
                downloadUrl?: string;
                filename?: string;
              };
              if (!res.ok || !data.downloadUrl) {
                throw new Error(data.error ?? `다운로드 준비 실패 (${res.status})`);
              }
              // Navigate to Storage signed URL — file never traverses Vercel body
              const a = document.createElement("a");
              a.href = data.downloadUrl;
              a.download = data.filename ?? "report_draft.docx";
              a.rel = "noopener";
              document.body.appendChild(a);
              a.click();
              a.remove();
            } catch (e) {
              setError(e instanceof Error ? e.message : "다운로드 실패");
            }
          });
        }}
      >
        {pending ? "준비 중…" : "DOCX 다운로드"}
      </button>
      {error ? (
        <p className="max-w-xs text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
