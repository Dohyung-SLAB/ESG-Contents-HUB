"use client";

/** Renders AI Evidence Check payload for Review (and similar) screens. */
export function EvidenceCheckBody({ payload }: { payload: unknown }) {
  const data = payload as {
    checks?: Array<{
      claim: string;
      status: string;
      reason: string;
    }>;
    warnings?: string[];
  };

  return (
    <div className="space-y-2 text-sm">
      {(data.checks ?? []).map((c, i) => (
        <div key={`${c.claim}-${i}`} className="rounded border p-2">
          <p className="font-medium">{c.claim}</p>
          <p className="text-xs text-muted-foreground">
            {c.status} · {c.reason}
          </p>
        </div>
      ))}
      {(data.warnings ?? []).map((w) => (
        <p key={w} className="text-xs text-amber-700">
          {w}
        </p>
      ))}
    </div>
  );
}
