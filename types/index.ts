export * from "@/types/enums";
export * from "@/types/database";

/** UI helper for header/reporting-year display (not a DB table). */
export type ReportingYear = {
  id: string;
  year: number;
  label: string;
};
