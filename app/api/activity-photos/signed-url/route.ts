import { createActivityPhotoSignedUrl } from "@/lib/services/activity-photos";

export const runtime = "nodejs";

/** Short-lived signed URL to view an activity photo from the evidences bucket. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { storage_path?: string };
    const storagePath = String(body.storage_path ?? "").trim();
    const result = await createActivityPhotoSignedUrl(storagePath);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "요청 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
