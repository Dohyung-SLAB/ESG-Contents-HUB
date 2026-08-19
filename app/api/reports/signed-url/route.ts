import { getSessionUser } from "@/lib/data/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";

/** Issue a short-lived signed URL to view a PDF in the reports bucket. */
export async function POST(request: Request) {
  try {
    await getSessionUser();
    if (!isSupabaseConfigured()) {
      return Response.json(
        { error: "Supabase가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { storage_path?: string };
    const storagePath = String(body.storage_path ?? "").trim();
    if (!storagePath || storagePath.includes("..")) {
      return Response.json({ error: "storage_path가 필요합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from("reports")
      .createSignedUrl(storagePath, 300);
    if (error || !data?.signedUrl) {
      return Response.json(
        { error: error?.message || "서명 URL을 만들지 못했습니다." },
        { status: 500 },
      );
    }

    return Response.json({ url: data.signedUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "요청 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
