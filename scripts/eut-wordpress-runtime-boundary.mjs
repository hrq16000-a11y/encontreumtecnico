import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Static guard for WordPress-hosting runtime dependencies.
 * Canonical references to the official domain are intentional SEO values.
 * Historical lookups via the imported Supabase snapshot are NOT live WP calls.
 * This check cannot substitute network tracing / end-to-end validation.
 */
const sourceRoot = "src";
const allowedExtensions = /\.(?:ts|tsx)$/;
const forbidden = [
  /\b(?:fetch|axios\.(?:get|post)|XMLHttpRequest|EventSource)\s*\(\s*[`'"]https?:\/\/(?:www\.)?encontreumtecnico\.com\/[^'`"]*/i,
  /https?:\/\/(?:www\.)?encontreumtecnico\.com\/\s*(?:wp-json|wp-content|wp-admin|xmlrpc\.php|wp-includes|wp-login\.php)/i,
];
let scanned = 0;
const failures = [];
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    if (!allowedExtensions.test(entry.name)) continue;
    scanned++;
    const source = readFileSync(path, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(source)) {
        failures.push(relative(".", path) + " matches " + pattern.source.slice(0, 50));
      }
    }
  }
}
scan(sourceRoot);
const login = readFileSync("src/routes/entrar.tsx", "utf8");
const helper = readFileSync("src/lib/onboarding-legacy-fallback.ts", "utf8");
const serverRole = readFileSync("src/routes/area-tecnico.tsx", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

for (const [label, ok] of [
  ["role is still assigned by the server", login.includes('supabase.rpc("choose_account_type", { _role: role })')],
  ["legacy recovery remains opt-in", login.includes("eut_confirm_my_legacy_account")],
  ["optional discovery error does not block new registration", login.includes("canAttemptRole") && helper.includes("state.legacyLookupError")],
  ["known historical roles are not overridden", helper.includes("state.legacyRole === null")],
  ["technician publishing remains server controlled", serverRole.includes('activationDb.rpc("eut_publish_my_technician"')],
  ["automatic Vercel deployment disabled", vercel.git?.deploymentEnabled === false],
]) if (!ok) failures.push(label);
if (failures.length) throw new Error("WordPress runtime isolation FAILED:\n- " + failures.join("\n- "));
console.log(`WordPress runtime boundary: PASS, ${scanned} TypeScript files checked.`);
console.log("No direct WordPress-hosting API/media request pattern detected. Not equivalent to an E2E network audit.");
