import { createExtractionJobFromUpload } from "@/lib/services/extraction";

export const runtime = "nodejs";
/** PDF + OpenAI outline can exceed default Hobby timeouts on larger reports. */
export const maxDuration = 300;

/**
 * Start extraction for a PDF already in Supabase Storage.
 * Body must be small JSON only — never multipart PDF (Vercel ~4.5MB cap).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      storage_path?: string;
      filename?: string;
      toc_section?: string;
    };
    const storagePath = String(body.storage_path ?? "").trim();
    const filename = String(body.filename ?? "").trim();
    const tocSection = String(body.toc_section ?? "").trim();

    if (!storagePath || !filename || !tocSection) {
      return Response.json(
        {
          error:
            "storage_path, filename, toc_section이 필요합니다. PDF는 /api/extraction/prepare 후 Storage로 직접 업로드하세요.",
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
