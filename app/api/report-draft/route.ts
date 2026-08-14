import { buildReportDraftModel, generateReportDocx } from "@/lib/services/report-draft";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const approvedOnly = searchParams.get("approvedOnly") === "1";

  try {
    const model = await buildReportDraftModel({ approvedOnly });
    const buffer = await generateReportDocx(model);
    const filename = encodeURIComponent(
      `${model.companyName}_${model.reportingYear}_report_draft.docx`,
    );
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "DOCX 생성 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}
