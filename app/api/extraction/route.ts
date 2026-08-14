import { createExtractionJobFromUpload } from "@/lib/services/extraction";

export const runtime = "nodejs";
/** PDF + OpenAI outline can exceed default Hobby timeouts on larger reports. */
export const maxDuration = 300;

async function parseJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    // Preferred path on Vercel: PDF already in Supabase Storage (JSON only).
    if (contentType.includes("application/json")) {
      const body = await parseJsonBody(request);
      const storagePath = String(body?.storage_path ?? "").trim();
      const filename = String(body?.filename ?? "").trim();
      const tocSection = String(body?.toc_section ?? "").trim();
      if (!storagePath || !filename || !tocSection) {
        return Response.json(
          {
            error:
              "storage_path, filename, toc_section이 필요합니다. (큰 PDF는 Storage 업로드 후 호출)",
          },
          { status: 400 },
        );
      }
      const result = await createExtractionJobFromUpload({
        filename,
        toc_section: tocSection,
        storage_path: storagePath,
      });
      return Response.json(result);
    }

    // Legacy / local small uploads: multipart FormData through the function.
    // Vercel hard-limits this path to ~4.5MB — prefer JSON + Storage above.
    const form = await request.formData();
    const file = form.get("file");
    const tocSection = String(form.get("toc_section") ?? "").trim();

    if (!(file instanceof File)) {
      return Response.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    }
    if (!tocSection) {
      return Response.json(
        { error: "목차명(TOC section)을 입력하세요." },
        { status: 400 },
      );
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return Response.json(
        {
          error:
            "Vercel에서는 4.5MB 초과 PDF를 서버로 직접 보낼 수 없습니다. Storage 업로드 경로를 사용하세요.",
        },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await createExtractionJobFromUpload({
      filename: file.name,
      toc_section: tocSection,
      file_bytes: bytes,
    });

    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
