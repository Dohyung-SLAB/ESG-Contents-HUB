import type { Company, Profile, Project, ReportingYear } from "@/types";

/** Static pilot context (삼립) until Task 03+ wires real data. */
export const mockCompany: Pick<Company, "id" | "name"> = {
  id: "company-samlip",
  name: "삼립",
};

export const mockProject: Pick<
  Project,
  "id" | "name" | "company_id" | "reporting_year" | "status"
> = {
  id: "project-2027-sr",
  name: "2027 Sustainability Report",
  company_id: mockCompany.id,
  reporting_year: 2027,
  status: "ACTIVE",
};

export const mockReportingYear: ReportingYear = {
  id: "year-2027",
  year: 2027,
  label: "2027",
};

export const mockUser: Pick<
  Profile,
  "id" | "full_name" | "email" | "role"
> = {
  id: "user-admin",
  full_name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN",
};
