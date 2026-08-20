import { prepareActivityPhotoUpload } from "@/lib/services/activity-photos";

export const runtime = "nodejs";

/** Issue a signed Storage upload URL for activity photos (images only). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      filename?: string;
      byteLength?: number;
      content_version_id?: string;
    };
    const filename = String(body.filename ?? "").trim();
    const contentVersionId = String(body.content_version_id ?? "").trim();
    const byteLength = Number(body.byteLength ?? 0);
    if (!filename || !contentVersionId) {
      return Response.json(
        { error: "filename, content_version_id가 필요합니다." },
        { status: 400 },
      );
    }
    const result = await prepareActivityPhotoUpload({
      filename,
      byteLength,
      content_version_id: contentVersionId,
    });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Prepare failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
