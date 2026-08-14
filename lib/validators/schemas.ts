import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("유효한 이메일을 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

export const annualUpdateSchema = z.object({
  blockId: z.string().min(1),
  change_type: z.enum(["PENDING", "NO_CHANGE", "MODIFIED", "NEW", "DELETED"]),
  narrative: z.string().nullable().optional(),
  submit: z.boolean().optional(),
});

export const evidenceUploadSchema = z.object({
  filename: z.string().min(1),
  content_version_id: z.string().uuid().or(z.string().min(1)),
  relationship_type: z
    .enum(["PRIMARY", "SUPPORTING", "REFERENCE"])
    .default("SUPPORTING"),
});
