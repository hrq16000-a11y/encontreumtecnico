import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const change = readFileSync("docs/sql/eut-public-eligibility-paid-contact-20261120.sql", "utf8");
const rollback = readFileSync("docs/sql/eut-public-eligibility-paid-contact-rollback-20261120.sql", "utf8");

describe("public portal technician eligibility migration", () => {
  it("requires both a valid private Brazilian phone and explicit paid-contact consent", () => {
    expect(change).toContain("c.allow_paid_contact IS TRUE");
    expect(change).toContain("c.phone_e164 ~ '^[+]55[1-9]{2}[2-9][0-9]{7,8}$'");
    expect(change).toContain("AND EXISTS (");
  });

  it("preserves the account and phone-ban vetoes in the private helper", () => {
    expect(change).toContain("eut_moderation.blocked_accounts");
    expect(change).toContain("eut_moderation.blocked_phones");
    expect(change).toContain("SECURITY DEFINER");
    expect(change).toContain("SET search_path TO 'pg_catalog'");
    expect(change).toContain("Eligibility definition drifted");
  });

  it("changes only the helper, with rollback and without table or RLS mutations", () => {
    for (const sql of [change, rollback]) {
      expect(sql).toContain("BEGIN;");
      expect(sql).toContain("COMMIT;");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION eut_visibility.eut_public_technician_eligible");
      expect(sql).not.toMatch(/\b(?:INSERT INTO|UPDATE|DELETE FROM|DROP TABLE|ALTER TABLE|CREATE POLICY|DROP POLICY|GRANT|REVOKE)\s+/i);
    }
    expect(rollback.split("AS $function$")[1]).not.toContain("c.allow_paid_contact IS TRUE");
  });
});
