"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { actionUpdateBlockFrameworks } from "@/lib/actions";
import {
  DISCLOSURE_FRAMEWORKS,
  ESG_EVAL_FRAMEWORKS,
  normalizeFrameworkList,
  type DisclosureFramework,
  type EsgEvalFramework,
} from "@/lib/frameworks";
import { cn } from "@/lib/utils";

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "esg" | "disclosure";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        tone === "esg"
          ? "bg-[#dfe6f0] text-[#32466b] ring-1 ring-[#32466b]/30"
          : "bg-[#f3e0e0] text-[#970404] ring-1 ring-[#970404]/25",
      )}
    >
      {label}
    </span>
  );
}

/** Compact read-only chips for lists / report preview. */
export function FrameworkTagsBadges({
  esgFrameworks,
  disclosureFrameworks,
  className,
  emptyLabel = "미지정",
}: {
  esgFrameworks?: string[] | null;
  disclosureFrameworks?: string[] | null;
  className?: string;
  emptyLabel?: string;
}) {
  const esg = normalizeFrameworkList(esgFrameworks, ESG_EVAL_FRAMEWORKS);
  const disclosure = normalizeFrameworkList(
    disclosureFrameworks,
    DISCLOSURE_FRAMEWORKS,
  );
  if (esg.length === 0 && disclosure.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {emptyLabel}
      </span>
    );
  }
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {esg.map((fw) => (
        <Badge key={`e-${fw}`} label={fw} tone="esg" />
      ))}
      {disclosure.map((fw) => (
        <Badge key={`d-${fw}`} label={fw} tone="disclosure" />
      ))}
    </div>
  );
}

export type FrameworkTagsSavePayload = {
  esg_frameworks: EsgEvalFramework[];
  disclosure_frameworks: DisclosureFramework[];
};

/**
 * Manual ESG evaluation + disclosure framework tags.
 * Default: persists on content_blocks via blockId.
 * Pass `onSave` for extraction candidates (or other stores).
 */
export function FrameworkTagsEditor({
  blockId,
  esgFrameworks,
  disclosureFrameworks,
  editable = true,
  className,
  onSave,
}: {
  blockId?: string;
  esgFrameworks?: string[] | null;
  disclosureFrameworks?: string[] | null;
  editable?: boolean;
  className?: string;
  onSave?: (next: FrameworkTagsSavePayload) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const esg = normalizeFrameworkList(esgFrameworks, ESG_EVAL_FRAMEWORKS);
  const disclosure = normalizeFrameworkList(
    disclosureFrameworks,
    DISCLOSURE_FRAMEWORKS,
  );

  function toggle(kind: "esg" | "disclosure", value: string) {
    if (!editable || pending) return;

    const next: FrameworkTagsSavePayload = {
      esg_frameworks: [...esg],
      disclosure_frameworks: [...disclosure],
    };

    if (kind === "esg") {
      const fw = value as EsgEvalFramework;
      next.esg_frameworks = esg.includes(fw)
        ? esg.filter((v) => v !== fw)
        : [...esg, fw];
    } else {
      const fw = value as DisclosureFramework;
      next.disclosure_frameworks = disclosure.includes(fw)
        ? disclosure.filter((v) => v !== fw)
        : [...disclosure, fw];
    }

    startTransition(async () => {
      if (onSave) {
        await onSave(next);
      } else if (blockId) {
        await actionUpdateBlockFrameworks(blockId, next);
      } else {
        throw new Error("blockId 또는 onSave가 필요합니다.");
      }
      router.refresh();
    });
  }

  if (!editable) {
    return (
      <div className={cn("space-y-2", className)}>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            ESG 평가기준
          </p>
          <FrameworkTagsBadges
            esgFrameworks={esg}
            disclosureFrameworks={[]}
            emptyLabel="선택 없음"
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            공시기준
          </p>
          <FrameworkTagsBadges
            esgFrameworks={[]}
            disclosureFrameworks={disclosure}
            emptyLabel="선택 없음"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-xs font-medium text-[var(--brand-navy)]">
          ESG 평가기준 (수동 선택)
        </p>
        <p className="text-[11px] text-muted-foreground">
          AI가 판단하지 않습니다. 해당하는 항목만 체크하세요.
        </p>
        <div className="flex flex-wrap gap-3">
          {ESG_EVAL_FRAMEWORKS.map((fw) => (
            <label key={fw} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={esg.includes(fw)}
                disabled={pending}
                onChange={() => toggle("esg", fw)}
              />
              {fw}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-xs font-medium text-[var(--brand-navy)]">
          공시기준 (수동 선택)
        </p>
        <p className="text-[11px] text-muted-foreground">
          AI가 판단하지 않습니다. 해당하는 항목만 체크하세요.
        </p>
        <div className="flex flex-wrap gap-3">
          {DISCLOSURE_FRAMEWORKS.map((fw) => (
            <label key={fw} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={disclosure.includes(fw)}
                disabled={pending}
                onChange={() => toggle("disclosure", fw)}
              />
              {fw}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
