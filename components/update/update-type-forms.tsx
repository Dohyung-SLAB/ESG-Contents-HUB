"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KeyFactValueType } from "@/types/enums";

export type FactDraft = {
  key: string;
  value_text: string;
  value_number: string;
  unit: string;
  value_type: KeyFactValueType;
};

type FactsProps = {
  facts: FactDraft[];
  onChange: (facts: FactDraft[]) => void;
  hint?: string;
};

function FactEditor({ facts, onChange, hint }: FactsProps) {
  return (
    <div className="space-y-2">
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {facts.map((fact, idx) => (
        <div key={`${fact.key}-${idx}`} className="grid grid-cols-[1fr_1fr_80px] gap-2">
          <Input value={fact.key} disabled />
          {fact.value_type === "FREQUENCY" || fact.value_type === "TEXT" ? (
            <Input
              value={fact.value_text}
              onChange={(e) => {
                const next = [...facts];
                next[idx] = { ...fact, value_text: e.target.value };
                onChange(next);
              }}
            />
          ) : (
            <Input
              type="number"
              value={fact.value_number}
              onChange={(e) => {
                const next = [...facts];
                next[idx] = { ...fact, value_number: e.target.value };
                onChange(next);
              }}
            />
          )}
          <Input
            value={fact.unit}
            onChange={(e) => {
              const next = [...facts];
              next[idx] = { ...fact, unit: e.target.value };
              onChange(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function NarrativeUpdateForm(props: FactsProps & { notes: string; onNotes: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Label>서술형 변경 메모 (전문 재작성 금지)</Label>
      <textarea
        className="min-h-20 w-full rounded-md border p-2 text-sm"
        value={props.notes}
        onChange={(e) => props.onNotes(e.target.value)}
        placeholder="변경된 사실만 간단히 기록하세요"
      />
      <FactEditor {...props} hint="관련 Key Facts" />
    </div>
  );
}

export function StructureUpdateForm(props: FactsProps) {
  return <FactEditor {...props} hint="조직·회의체 등 구조 변경 Key Facts" />;
}

export function ActivityUpdateForm(props: FactsProps) {
  return <FactEditor {...props} hint="활동 실적 Key Facts (예: 적용 매장, 주기)" />;
}

export function NumericUpdateForm(props: FactsProps) {
  return <FactEditor {...props} hint="수치 실적 Key Facts" />;
}

export function TargetUpdateForm(props: FactsProps) {
  return <FactEditor {...props} hint="목표·실적 Key Facts" />;
}

export function CertificationUpdateForm(props: FactsProps) {
  return <FactEditor {...props} hint="인증 현황 Key Facts" />;
}

export type FormSchemaField = {
  key: string;
  label: string;
  value_type: KeyFactValueType;
  unit?: string;
};

export function DynamicFormRenderer({
  fields,
  facts,
  onChange,
}: {
  fields: FormSchemaField[];
  facts: FactDraft[];
  onChange: (facts: FactDraft[]) => void;
}) {
  const mapped = fields.map((field) => {
    const existing = facts.find((f) => f.key === field.key);
    return (
      existing ?? {
        key: field.key,
        value_text: "",
        value_number: "",
        unit: field.unit ?? "",
        value_type: field.value_type,
      }
    );
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Dynamic Form (form_schema)</p>
      <FactEditor
        facts={mapped}
        onChange={(next) => {
          // preserve any extra facts not in schema
          const keys = new Set(next.map((f) => f.key));
          const extras = facts.filter((f) => !keys.has(f.key));
          onChange([...next, ...extras]);
        }}
      />
    </div>
  );
}

export function UpdateTypeForm({
  updateType,
  formSchema,
  facts,
  onChange,
  notes,
  onNotes,
}: {
  updateType: string;
  formSchema: Record<string, unknown>;
  facts: FactDraft[];
  onChange: (facts: FactDraft[]) => void;
  notes: string;
  onNotes: (v: string) => void;
}) {
  const schemaFields = Array.isArray((formSchema as { fields?: unknown }).fields)
    ? ((formSchema as { fields: FormSchemaField[] }).fields)
    : [];

  if (schemaFields.length > 0) {
    return (
      <DynamicFormRenderer
        fields={schemaFields}
        facts={facts}
        onChange={onChange}
      />
    );
  }

  const common = { facts, onChange };
  switch (updateType) {
    case "STRUCTURE":
      return <StructureUpdateForm {...common} />;
    case "ACTIVITY":
      return <ActivityUpdateForm {...common} />;
    case "NUMERIC":
      return <NumericUpdateForm {...common} />;
    case "TARGET":
      return <TargetUpdateForm {...common} />;
    case "CERTIFICATION":
      return <CertificationUpdateForm {...common} />;
    case "NARRATIVE":
    default:
      return <NarrativeUpdateForm {...common} notes={notes} onNotes={onNotes} />;
  }
}
