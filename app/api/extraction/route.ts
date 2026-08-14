import { createExtractionJobFromUpload } from "@/lib/services/extraction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
