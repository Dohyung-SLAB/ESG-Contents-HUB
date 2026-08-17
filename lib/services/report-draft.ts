import { newId } from "@/lib/data/ids";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { getPilotStore } from "@/lib/data/pilot-store";
import { parseNarrativeBlocks } from "@/lib/markdown-content";
import {
  getActiveWorkspace,
  listIssuesForActiveProject,
} from "@/lib/services/projects";
import { toStorageObjectName } from "@/lib/storage-key";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  ContentBlock,
  ContentVersion,
  Issue,
  KeyFact,
} from "@/types/database";
import type { ContentStatus } from "@/types/enums";

export type ReportDraftBlock = {
  block: ContentBlock;
  issue: Issue | null;
  version: ContentVersion;
  key_facts: KeyFact[];
};

export type ReportDraftSection = {
  /** TOC / extraction section title (e.g. 소비자 신뢰 확보) */
  title: string;
  blocks: ReportDraftBlock[];
};

export type ReportDraftModel = {
  companyName: string;
  projectName: string;
  reportingYear: number;
  /** Flat list (DOCX + legacy) */
  blocks: ReportDraftBlock[];
  /** Grouped by content_blocks.section (TOC) */
  sections: ReportDraftSection[];
};

function normalizeTocSectionTitle(raw: string): string {
  const parts = raw
    .split(/\s*>\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const part of parts) {
    if (deduped[deduped.length - 1] !== part) deduped.push(part);
  }
  // Report Draft groups by the top-level TOC title (first segment).
  return deduped[0] ?? raw.trim() ?? "기타";
}

function groupBlocksByTocSection(
  blocks: ReportDraftBlock[],
): ReportDraftSection[] {
  const order: string[] = [];
  const map = new Map<string, ReportDraftBlock[]>();
  for (const item of blocks) {
    const title = normalizeTocSectionTitle(
      item.block.section?.trim() ||
        item.issue?.name?.trim() ||
        "기타",
    );
    if (!map.has(title)) {
      map.set(title, []);
      order.push(title);
    }
    map.get(title)!.push(item);
  }
  return order.map((title) => ({
    title,
    blocks: map.get(title)!,
  }));
}

function emptyModel(
  companyName: string,
  projectName: string,
  reportingYear: number,
): ReportDraftModel {
  return {
    companyName,
    projectName,
    reportingYear,
    blocks: [],
    sections: [],
  };
}

export async function buildReportDraftModel(options?: {
  approvedOnly?: boolean;
}): Promise<ReportDraftModel> {
  const approvedOnly = options?.approvedOnly ?? false;
  const { company, project } = await getActiveWorkspace();
  const issues = await listIssuesForActiveProject();
  const issueIds = issues.map((i) => i.id);
  const issueMap = new Map(issues.map((i) => [i.id, i]));
  const reportingYear = project.reporting_year;

  if (issueIds.length === 0) {
    return emptyModel(company.name, project.name, reportingYear);
  }

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const blocks = store.content_blocks
      .filter((b) => issueIds.includes(b.issue_id) && b.is_active)
      .sort((a, b) => a.display_order - b.display_order);

    const draftBlocks: ReportDraftBlock[] = [];
    for (const block of blocks) {
      const versions = store.content_versions
        .filter((v) => v.content_block_id === block.id)
        .sort((a, b) => b.reporting_year - a.reporting_year);
      const preferred =
        versions.find(
          (v) =>
            v.reporting_year === reportingYear &&
            (!approvedOnly || v.status === "APPROVED"),
        ) ??
        versions.find((v) => !approvedOnly || v.status === "APPROVED") ??
        null;
      if (!preferred) continue;
      draftBlocks.push({
        block,
        issue: issueMap.get(block.issue_id) ?? null,
        version: preferred,
        key_facts: store.key_facts
          .filter((k) => k.content_version_id === preferred.id)
          .sort((a, b) => a.display_order - b.display_order),
      });
    }

    return {
      companyName: company.name,
      projectName: project.name,
      reportingYear,
      blocks: draftBlocks,
      sections: groupBlocksByTocSection(draftBlocks),
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: blocks } = await admin
    .from("content_blocks")
    .select("*")
    .in("issue_id", issueIds)
    .eq("is_active", true)
    .order("display_order");

  const blockList = (blocks ?? []) as ContentBlock[];
  const blockIds = blockList.map((b) => b.id);
  if (blockIds.length === 0) {
    return emptyModel(company.name, project.name, reportingYear);
  }

  const { data: versions } = await admin
    .from("content_versions")
    .select("*")
    .in("content_block_id", blockIds);
  const versionList = (versions ?? []) as ContentVersion[];
  const { data: facts } = await admin.from("key_facts").select("*");
  const factList = (facts ?? []) as KeyFact[];

  const draftBlocks: ReportDraftBlock[] = [];
  for (const block of blockList) {
    const versionsForBlock = versionList
      .filter((v) => v.content_block_id === block.id)
      .sort((a, b) => b.reporting_year - a.reporting_year);
    const preferred =
      versionsForBlock.find(
        (v) =>
          v.reporting_year === reportingYear &&
          (!approvedOnly || v.status === "APPROVED"),
      ) ??
      versionsForBlock.find((v) => !approvedOnly || v.status === "APPROVED") ??
      null;
    if (!preferred) continue;
    draftBlocks.push({
      block,
      issue: issueMap.get(block.issue_id) ?? null,
      version: preferred,
      key_facts: factList
        .filter((k) => k.content_version_id === preferred.id)
        .sort((a, b) => a.display_order - b.display_order),
    });
  }

  return {
    companyName: company.name,
    projectName: project.name,
    reportingYear,
    blocks: draftBlocks,
    sections: groupBlocksByTocSection(draftBlocks),
  };
}

function statusLabel(status: ContentStatus) {
  return status;
}

export async function generateReportDocx(
  model: ReportDraftModel,
): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: `${model.companyName} ${model.reportingYear} 지속가능경영보고서 초안`,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${model.projectName} · 생성일 ${new Date().toLocaleDateString("ko-KR")}`,
          italics: true,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: "목차", heading: HeadingLevel.HEADING_1 }),
  ];

  const sections =
    model.sections.length > 0
      ? model.sections
      : groupBlocksByTocSection(model.blocks);

  sections.forEach((section, sIdx) => {
    children.push(
      new Paragraph({
        text: `${sIdx + 1}. ${section.title}`,
        heading: HeadingLevel.HEADING_2,
      }),
    );
    section.blocks.forEach((b, bIdx) => {
      children.push(
        new Paragraph({
          text: `  ${sIdx + 1}.${bIdx + 1} ${b.block.title}`,
        }),
      );
    });
  });

  children.push(new Paragraph({ text: "" }));

  for (const [sIdx, section] of sections.entries()) {
    children.push(
      new Paragraph({
        text: `${sIdx + 1}. ${section.title}`,
        heading: HeadingLevel.HEADING_1,
      }),
    );

    for (const [bIdx, item] of section.blocks.entries()) {
      children.push(
        new Paragraph({
          text: `${sIdx + 1}.${bIdx + 1} ${item.block.title}`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${item.block.code} · ${item.block.content_type} · ${statusLabel(item.version.status)}`,
              size: 18,
              color: "666666",
            }),
          ],
        }),
        ...narrativeToDocx(item.version.narrative),
      );

      if (item.key_facts.length > 0) {
        children.push(
          new Paragraph({ text: "Key Facts", heading: HeadingLevel.HEADING_3 }),
        );
        for (const f of item.key_facts) {
          const value =
            f.value_number != null
              ? `${f.value_number}${f.unit ? ` ${f.unit}` : ""}`
              : (f.value_text ?? "");
          children.push(new Paragraph({ text: `• ${f.key}: ${value}` }));
        }
      }

      if (item.version.change_summary) {
        children.push(
          new Paragraph({
            text: "Change Summary",
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph({ text: item.version.change_summary }),
        );
      }

      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/**
 * Build DOCX on the server, upload to Storage, return a short-lived signed URL.
 * Avoids returning multi-MB binaries through the Vercel Function response body.
 */
export async function createReportDraftDownload(options?: {
  approvedOnly?: boolean;
}): Promise<{ filename: string; downloadUrl: string; storagePath: string }> {
  const model = await buildReportDraftModel(options);
  const buffer = await generateReportDocx(model);
  const filename = `${model.companyName}_${model.reportingYear}_report_draft.docx`;
  const safeFile = toStorageObjectName(filename);

  if (!isSupabaseConfigured()) {
    throw new Error(
      "DOCX 다운로드에는 Supabase Storage가 필요합니다. 환경 변수를 확인하세요.",
    );
  }

  const { company, project } = await getActiveWorkspace();
  const admin = createSupabaseAdminClient();
  const { error: bucketErr } = await admin.storage.createBucket(
    "report-drafts",
    {
      public: false,
      fileSizeLimit: 52428800,
      allowedMimeTypes: [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    },
  );
  if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
    // ignore; signed URL surfaces real issues
  }

  const storagePath = `${company.id}/${project.id}/${newId()}/${safeFile}`;
  const { error: upErr } = await admin.storage
    .from("report-drafts")
    .upload(storagePath, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: signed, error: signErr } = await admin.storage
    .from("report-drafts")
    .createSignedUrl(storagePath, 120);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message ?? "다운로드 URL 생성 실패");
  }

  return {
    filename: safeFile,
    downloadUrl: signed.signedUrl,
    storagePath,
  };
}

function narrativeToDocx(narrative: string | null | undefined) {
  const text = narrative?.trim() ?? "";
  if (!text) {
    return [new Paragraph({ text: "(서술 없음)" })];
  }

  const out: Array<Paragraph | Table> = [];
  for (const block of parseNarrativeBlocks(text)) {
    if (block.type === "paragraph") {
      for (const line of block.text.split("\n")) {
        out.push(new Paragraph({ text: line }));
      }
      continue;
    }

    const colCount = Math.max(
      block.headers.length,
      ...block.rows.map((r) => r.length),
      1,
    );
    const colWidth = Math.floor(9000 / colCount);
    const headerRow = new TableRow({
      children: block.headers.map(
        (h) =>
          new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true })],
              }),
            ],
          }),
      ),
    });
    const bodyRows = block.rows.map(
      (row) =>
        new TableRow({
          children: Array.from({ length: colCount }, (_, i) => {
            return new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              children: [new Paragraph({ text: row[i] ?? "" })],
            });
          }),
        }),
    );
    out.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [headerRow, ...bodyRows],
      }),
      new Paragraph({ text: "" }),
    );
  }
  return out;
}
