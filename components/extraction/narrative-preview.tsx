"use client";

import { parseNarrativeBlocks } from "@/lib/markdown-content";

/** Renders extraction narrative with Markdown pipe tables preserved. */
export function NarrativePreview({
  narrative,
  className,
}: {
  narrative: string;
  className?: string;
}) {
  const blocks = parseNarrativeBlocks(narrative);
  if (blocks.length === 0) {
    return (
      <p className={className ?? "text-sm text-muted-foreground"}>(내용 없음)</p>
    );
  }

  return (
    <div className={className ?? "space-y-3 text-sm leading-relaxed"}>
      {blocks.map((b, idx) => {
        if (b.type === "paragraph") {
          return (
            <p key={idx} className="whitespace-pre-wrap">
              {b.text}
            </p>
          );
        }
        return (
          <div key={idx} className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse border border-slate-300 text-left text-xs">
              <thead>
                <tr className="bg-slate-50">
                  {b.headers.map((h, hi) => (
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
                {b.rows.map((row, ri) => (
                  <tr key={ri}>
                    {b.headers.map((_, ci) => (
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
        );
      })}
    </div>
  );
}
