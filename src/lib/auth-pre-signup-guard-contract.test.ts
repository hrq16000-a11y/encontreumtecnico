import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("docs/sql/eut-auth-before-user-created-guard-20261111.sql", "utf8");
const smoke = readFileSync("docs/sql/eut-auth-hook-smoke-20261111.sql", "utf8");
const rollout = readFileSync("docs/admin/EUT_AUTH_HOOK_HOMOLOGACAO_2026-11-11.md", "utf8");

describe("Before User Created: proteção por identidade conhecida", () => {
  it("não depende do frontend e consulta as restrições privadas já existentes", () => {
    expect(hook).toContain("CREATE OR REPLACE FUNCTION eut_moderation.before_user_created_guard(event jsonb)");
    expect(hook).toContain("SECURITY DEFINER");
    expect(hook).toContain("SET search_path = pg_catalog");
    expect(hook).toContain("eut_moderation.blocked_accounts");
    expect(hook).toContain("eut_moderation.blocked_phones");
    expect(hook).toContain("JOIN auth.users AS u ON u.id = b.user_id");
    expect(hook).toContain("lower(btrim(coalesce(u.email, '')))");
    expect(hook).toContain("b.phone_digits = v_phone");
    expect(hook).toContain("RETURN '{}'::jsonb");
    expect(hook).toContain("'http_code', 403");
    expect(hook).not.toMatch(/\b(DELETE|TRUNCATE)\s+(FROM\s+)?auth\.users/i);
  });

  it("nunca confia no telefone e no papel enviados por metadados editáveis", () => {
    expect(hook).toContain("event->'user'->>'phone'");
    expect(hook).not.toContain("event->'user'->'user_metadata'");
    expect(hook).not.toMatch(/user_metadata\s*->>\s*'role'/i);
    expect(hook).not.toContain("ip_address'");
    expect(hook).toContain("Não foi possível concluir seu cadastro. Consulte o suporte.");
  });

  it("não expõe a função privada a visitantes ou a contas comuns", () => {
    expect(hook).toMatch(/REVOKE ALL ON FUNCTION eut_moderation\.before_user_created_guard\(jsonb\)[\s\S]*FROM PUBLIC, anon, authenticated;/);
    expect(hook).toContain("GRANT EXECUTE ON FUNCTION eut_moderation.before_user_created_guard(jsonb)");
    expect(hook).toContain("TO supabase_auth_admin;");
    expect(hook).toContain("has_function_privilege('anon'");
    expect(hook).toContain("has_function_privilege('authenticated'");
    expect(hook).not.toContain("GRANT ALL ON eut_moderation.blocked_accounts");
  });

  it("tem smoke sem mudanças e não ativa Auth Hook automaticamente", () => {
    expect(smoke).toContain("DO $smoke$");
    expect(smoke).toContain("v_result <> '{}'::jsonb");
    expect(smoke).toContain("v_result->'error'->>'http_code'");
    expect(smoke).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\s/im);
    expect(rollout).toContain("Authentication > Hooks > Before User Created");
    expect(rollout).toContain("desabilitar o hook");
    expect(rollout).toContain("não há outro hook");
    expect(rollout).toContain("PR #133");
  });
});
