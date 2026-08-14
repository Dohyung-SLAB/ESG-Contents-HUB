import { prepareReportUpload } from "@/lib/services/extraction";

export const runtime = "nodejs";

/** Issue a signed Storage upload URL (small JSON response — Vercel-safe). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      filename?: string;
      byteLength?: number;
    };
    const filename = String(body.filename ?? "").trim();
    const byteLength = Number(body.byteLength ?? 0);
    if (!filename) {
      return Response.json({ error: "파일명이 필요합니다." }, { status: 400 });
    }
    const result = await prepareReportUpload({ filename, byteLength });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Prepare failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
