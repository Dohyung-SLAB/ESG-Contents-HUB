import type { ContentBlock, FormSchema } from "@/types/database";

export type ConsultantGuides = {
  /** 공시 프레임워크(KSSB/GRI/SASB 등) 작성 가이드 */
  disclosure: string;
  /** 평가 프레임워크(KCGS/MSCI/DJSI 등) 대응 가이드 */
  evaluation: string;
};

export function getConsultantGuides(
  block: Pick<ContentBlock, "form_schema">,
): ConsultantGuides {
  const fs = (block.form_schema ?? {}) as FormSchema;
  const nested =
    fs.consultant_guides && typeof fs.consultant_guides === "object"
      ? (fs.consultant_guides as Record<string, unknown>)
      : null;
  return {
    disclosure:
      typeof nested?.disclosure === "string"
        ? nested.disclosure
        : typeof fs.consultant_guide_disclosure === "string"
          ? fs.consultant_guide_disclosure
          : "",
    evaluation:
      typeof nested?.evaluation === "string"
        ? nested.evaluation
        : typeof fs.consultant_guide_evaluation === "string"
          ? fs.consultant_guide_evaluation
          : "",
  };
}

export function mergeConsultantGuidesIntoSchema(
  existing: FormSchema | null | undefined,
  guides: ConsultantGuides,
): FormSchema {
  return {
    ...(existing ?? {}),
    consultant_guides: {
      disclosure: guides.disclosure.trim(),
      evaluation: guides.evaluation.trim(),
    },
  };
}
