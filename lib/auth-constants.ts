/** Client-safe auth domain helpers (no next/headers). */

export const CONSULTANT_EMAIL_DOMAIN = "sustainlab.co.kr";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isConsultantEmail(email: string) {
  return normalizeEmail(email).endsWith(`@${CONSULTANT_EMAIL_DOMAIN}`);
}
