"use client";

import {
  parseNarrativeBlocks,
  tableToChartSeries,
  type NarrativeBlock,
} from "@/lib/markdown-content";

/** Renders extraction narrative with Markdown tables, figure captions, and simple charts. */
export function NarrativePreview({
  narrative,
  className,
  showCharts = true,
}: {
  narrative: string;
  className?: string;
  /** When true, numeric markdown tables also get a bar chart. */
  showCharts?: boolean;
}) {
  const blocks = parseNarrativeBlocks(narrative);
  if (blocks.length === 0) {
    return (
      <p className={className ?? "text-sm text-muted-foreground"}>(내용 없음)</p>
    );
  }

  return (
    <div className={className ?? "space-y-3 text-sm leading-relaxed"}>
      {blocks.map((b, idx) => (
        <NarrativeBlockView key={idx} block={b} showCharts={showCharts} />
      ))}
    </div>
  );
}

function NarrativeBlockView({
  block,
  showCharts,
}: {
  block: NarrativeBlock;
  showCharts: boolean;
}) {
  if (block.type === "paragraph") {
    return <p className="whitespace-pre-wrap">{block.text}</p>;
  }

  if (block.type === "figure") {
    return (
      <div className="rounded-md border border-dashed border-[var(--brand-navy)]/30 bg-[var(--brand-navy)]/5 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--brand-navy)]">
          도표 / 그림 (원본 페이지 미리보기 참고)
        </p>
        <p className="mt-0.5 text-sm text-[var(--brand-ink)]">{block.caption}</p>
      </div>
    );
  }

  const chartSeries =
    showCharts && block.rows.length > 0
      ? tableToChartSeries(block.headers, block.rows)
      : null;

  return (
    <div className="space-y-2">
      {block.caption ? (
        <p className="text-xs font-medium text-[var(--brand-navy)]">
          {block.caption}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              {block.headers.map((h, hi) => (
                <th
                  key={hi}
                  className="border border-slate-300 px-2 py-1.5 font-semibold"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {block.headers.map((_, ci) => (
                  <td
                    key={ci}
                    className="border border-slate-300 px-2 py-1.5 align-top"
                  >
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chartSeries && chartSeries.length > 0 ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[11px] font-medium text-muted-foreground">
            표 수치 시각화 (추출 데이터 기준)
          </p>
          {chartSeries.map((series) => (
            <SimpleBarChart
              key={series.label}
              title={series.label}
              values={series.values}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SimpleBarChart({
  title,
  values,
}: {
  title: string;
  values: Array<{ series: string; value: number }>;
}) {
  const max = Math.max(...values.map((v) => Math.abs(v.value)), 1);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[var(--brand-ink)]">{title}</p>
      <ul className="space-y-1.5">
        {values.map((v) => {
          const width = Math.max(4, Math.round((Math.abs(v.value) / max) * 100));
          return (
            <li key={`${v.series}-${v.value}`} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                {v.series}
              </span>
              <div className="h-2.5 min-w-0 flex-1 rounded-sm bg-slate-200">
                <div
                  className="h-full rounded-sm bg-[var(--brand-red,#970404)]"
                  style={{ width: `${width}%` }}
                  title={String(v.value)}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-[var(--brand-ink)]">
                {formatChartNumber(v.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatChartNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("ko-KR");
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}
