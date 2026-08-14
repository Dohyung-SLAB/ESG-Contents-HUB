/**
 * Rebuild supabase/combined/apply_all.sql with UTF-8 (no PowerShell encoding).
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const files = [
  "supabase/migrations/20260813000000_init_esg_schema.sql",
  "supabase/migrations/20260813000001_rls_policies.sql",
  "supabase/seed.sql",
];

const parts = files.map((f) => fs.readFileSync(path.join(root, f), "utf8"));
const outPath = path.join(root, "supabase/combined/apply_all.sql");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, parts.join("\n\n"), "utf8");

const combined = fs.readFileSync(outPath, "utf8");
const expected = "VOC·CCM 운영 회의체";
const ok = combined.includes(expected) && !combined.includes("VOC쨌CCM");
const ct003 = combined.split("\n").find((l) => l.includes("CT-003")) ?? null;

// #region agent log
fs.appendFileSync(
  path.join(root, "debug-73438b.log"),
  JSON.stringify({
    sessionId: "73438b",
    runId: "fix-encoding",
    hypothesisId: "H1",
    location: "scripts/rebuild-apply-all.mjs",
    message: "apply_all rebuilt",
    data: {
      ok,
      bytes: Buffer.byteLength(combined, "utf8"),
      ct003,
    },
    timestamp: Date.now(),
  }) + "\n",
  "utf8",
);
// #endregion

console.log(JSON.stringify({ ok, bytes: Buffer.byteLength(combined, "utf8") }));
if (!ok) process.exit(1);
