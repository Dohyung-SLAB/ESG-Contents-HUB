"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a single PDF page from Supabase Storage (reports bucket)
 * so tables/charts in the source report are visible next to extracted text.
 */
export function SourcePagePreview({
  storagePath,
  page,
  className,
}: {
  storagePath: string | null | undefined;
  page: number | null | undefined;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!storagePath || !page || page < 1) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const canvas = canvasRef.current;

    async function render() {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch("/api/reports/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storage_path: storagePath }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || "PDF URL을 받지 못했습니다.");
        }

        const pdfjs = await import("pdfjs-dist");
        // CDN worker avoids Next bundler issues with pdf.worker.min.mjs
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const doc = await pdfjs.getDocument({ url: data.url }).promise;
        if (cancelled) return;
        const pageNum = Math.min(page!, doc.numPages);
        const pdfPage = await doc.getPage(pageNum);
        if (cancelled) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const maxWidth = canvas?.parentElement?.clientWidth || 640;
        const scale = Math.min(1.6, maxWidth / base.width);
        const viewport = pdfPage.getViewport({ scale });

        const target = canvasRef.current;
        if (!target || cancelled) return;
        const ctx = target.getContext("2d");
        if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.");

        target.width = viewport.width;
        target.height = viewport.height;
        // pdfjs-dist 4.x RenderParameters
        await pdfPage.render({
          canvasContext: ctx,
          viewport,
        } as Parameters<typeof pdfPage.render>[0]).promise;
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "페이지 렌더 실패");
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [storagePath, page]);

  if (!storagePath || !page || page < 1) {
    return null;
  }

  return (
    <div className={className ?? "rounded-md border bg-white"}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <p className="text-xs font-medium text-[var(--brand-navy)]">
            원본 PDF 페이지 {page}
          </p>
          <p className="text-[11px] text-muted-foreground">
            표·도표는 원본 페이지에서 확인하세요
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-[var(--brand-navy)] underline-offset-2 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "접기" : "펼치기"}
        </button>
      </div>
      {expanded ? (
        <div className="max-h-[32rem] overflow-auto bg-slate-100 p-2">
          {status === "loading" ? (
            <p className="p-3 text-xs text-muted-foreground">페이지 불러오는 중…</p>
          ) : null}
          {status === "error" ? (
            <p className="p-3 text-xs text-destructive">{error}</p>
          ) : null}
          <canvas
            ref={canvasRef}
            className={`mx-auto max-w-full ${status === "ready" ? "block" : "hidden"}`}
          />
        </div>
      ) : null}
    </div>
  );
}
