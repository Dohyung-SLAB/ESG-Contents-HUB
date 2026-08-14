import type { UserRole } from "@/types/enums";
import { SAMLIP_IDS } from "@/lib/seed/samlip-pilot";

/** Fixed demo auth/profile IDs (must match auth.users after ensure-demo-users). */
export const DEMO_USERS = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    email: "admin@samlip.local",
    password: "SamlipDemo1!",
    full_name: "Consultant Admin",
    role: "ADMIN" as UserRole,
    department: "컨설팅",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    email: "contributor@samlip.local",
    password: "SamlipDemo1!",
    full_name: "품질보증 담당",
    role: "CONTRIBUTOR" as UserRole,
    department: "품질보증",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    email: "reviewer@samlip.local",
    password: "SamlipDemo1!",
    full_name: "ESG 담당",
    role: "REVIEWER" as UserRole,
    department: "ESG",
  },
] as const;

export const DEMO_CONTRIBUTOR_ID = DEMO_USERS[1].id;
export const DEMO_REVIEWER_ID = DEMO_USERS[2].id;
export const DEMO_COMPANY_ID = SAMLIP_IDS.company;

export const SESSION_ROLE_COOKIE = "esg_demo_role";
export const SESSION_PROJECT_COOKIE = "esg_active_project_id";
