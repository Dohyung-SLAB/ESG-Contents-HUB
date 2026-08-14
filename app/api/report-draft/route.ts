import { createReportDraftDownload } from "@/lib/services/report-draft";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Returns a short-lived Storage signed URL for the generated DOCX.
 * Does not stream the binary through the Vercel response body (4.5MB cap).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const approvedOnly = searchParams.get("approvedOnly") === "1";

  try {
    const result = await createReportDraftDownload({ approvedOnly });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "DOCX 생성 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
