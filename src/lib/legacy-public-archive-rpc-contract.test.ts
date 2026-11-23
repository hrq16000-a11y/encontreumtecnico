import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const proposal = readFileSync(
  resolve(process.cwd(), "docs/sql/eut-legacy-archive-sanitized-rpc-proposal-20261122.sql"),
  "utf8",
);
const synthetic = readFileSync(
  resolve(process.cwd(), "docs/sql/tests/eut-legacy-archive-rpc-synthetic-20261122.sql"),
  "utf8",
);
// Static contract checks only. These tests do NOT execute SQL or prove live
// database privileges, SQL regex correctness, or full privacy in production.
const executable = proposal
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("proposed public legacy archive RPC contract (static)", () => {
  it("adds only a private sanitizer and bounded public RPC, no data migration", () => {
    expect(executable).toMatch(/CREATE SCHEMA eut_legacy_internal;/);
    expect(executable).toMatch(/CREATE FUNCTION eut_legacy_internal\.public_legacy_name\(_raw text\)/);
    expect(executable).toMatch(/CREATE FUNCTION public\.eut_public_legacy_archive_page\(/);
    expect(executable).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public\.legacy_public_archive|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i);
    expect(executable).not.toMatch(/REVOKE\s+(?:ALL|SELECT)\s+ON\s+(?:TABLE\s+)?public\.legacy_public_archive/i);
  });

  it("explicitly fails closed for unbounded pagination", () => {
    expect(executable).toMatch(/_limit < 1 OR _limit > 24/);
    expect(executable).toMatch(/_offset < 0 OR _offset > 24000/);
    expect(executable).toContain("ERRCODE = '22023'");
    expect(executable).toMatch(/ORDER BY a\.wp_post_id ASC\s+LIMIT _limit OFFSET _offset/);
    expect(executable).toContain("'count', (");
  });

  it("repeats eligibility in both the page and count branches", () => {
    expect((executable.match(/a\.validation_status = 'em_validacao'/g) ?? []).length).toBe(2);
    expect((executable.match(/a\.contact_enabled IS FALSE/g) ?? []).length).toBe(2);
    expect((executable.match(/a\.city_confirmed IS FALSE/g) ?? []).length).toBe(2);
  });

  it("limits returned keys and sanitizes name and tags before JSON output", () => {
    expect(executable).toContain("'display_name', eut_legacy_internal.public_legacy_name(page.display_name)");
    expect(executable).toContain("eut_legacy_internal.public_legacy_name(tagged.value) = tagged.value");
    for (const key of ["wp_post_id", "display_name", "sector_tags", "country_label", "validation_status"]) {
      expect(executable).toContain("'" + key + "'");
    }
    expect(executable).not.toMatch(/'(?:(?:phone|email|contact_enabled|city_confirmed|source_key|user_id|title|raw_name))'\s*,/i);
    expect(executable).not.toMatch(/'display_name'\s*,\s*page\.display_name\b/);
  });

  it("restricts schema and function grants without changing existing table grants", () => {
    expect(executable).toContain("REVOKE ALL ON SCHEMA eut_legacy_internal FROM PUBLIC, anon, authenticated;");
    expect(executable).toMatch(/SECURITY INVOKER\s+SET search_path TO pg_catalog/);
    expect(executable).toMatch(/SECURITY DEFINER\s+SET search_path TO pg_catalog/);
    expect(executable).toMatch(/REVOKE ALL ON FUNCTION eut_legacy_internal\.public_legacy_name\(text\)\s+FROM PUBLIC, anon, authenticated/);
    expect(executable).toMatch(/REVOKE ALL ON FUNCTION public\.eut_public_legacy_archive_page\(integer, integer\)\s+FROM PUBLIC, anon, authenticated/);
    expect(executable).toMatch(/GRANT EXECUTE ON FUNCTION public\.eut_public_legacy_archive_page\(integer, integer\)\s+TO anon, authenticated/);
  });

  it("keeps synthetic SQL checks isolated and does not query business rows", () => {
    expect(synthetic).toContain("BEGIN;");
    expect(synthetic).toContain("ROLLBACK;");
    expect(synthetic).toContain("DO $fixture$");
    expect(synthetic).not.toMatch(/\bFROM\s+public\.legacy_public_archive\b/i);
    for (const input of ["alexa@example.test", "(41) 99999-1234", "wa.me/5541999991234", "Suporte WhatsApp", "Ana Costa", "alexpaixao13"]) {
      expect(synthetic).toContain(input);
    }
  });
});
