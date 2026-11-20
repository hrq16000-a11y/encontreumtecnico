import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("docs/sql/eut-realtime-private-presence-confirmed-20261120.sql", "utf8");
const publisher = readFileSync("src/components/consented-visitor-presence.tsx", "utf8");
const observer = readFileSync("src/components/admin-live-presence.tsx", "utf8");
const root = readFileSync("src/routes/__root.tsx", "utf8");

describe("presença privada preparada, sem alterar políticas existentes", () => {
  it("não fornece leitura pública, limita tópicos e usa o papel administrativo atual", () => {
    expect(sql.match(/CREATE POLICY/g)).toHaveLength(2);
    expect(sql).toMatch(/FOR INSERT TO anon, authenticated/);
    expect(sql).toMatch(/FOR SELECT TO authenticated/);
    expect(sql).toMatch(/public\.has_role\(\(SELECT auth\.uid\(\)\), 'admin'::public\.app_role\)/);
    expect(sql).not.toMatch(/FOR SELECT TO anon/);
    expect(sql).not.toMatch(/ALTER TABLE.*ENABLE ROW LEVEL SECURITY/i);
    expect(sql.match(/eut-consented-visitor-tabs-v2-private/g)?.length).toBe(2);
  });

  it("prepara somente HTTP e requer duas flags desligadas por padrão", () => {
    const adapter = readFileSync("src/lib/visitor-http-presence.ts", "utf8");
    expect(publisher).not.toContain("supabase.channel(");
    expect(observer).not.toContain("supabase.channel(");
    expect(publisher).toContain('sendPresenceLease("leave", previous, true)');
    expect(observer).toContain("readAdminPresenceCount(data.session.access_token)");
    expect(root).toContain("HTTP_PRESENCE_READY && !hasRouteError");
    expect(adapter).toContain('env["VITE_EUT_HTTP_PRESENCE_INGEST"] === "enabled"');
    expect(adapter).toContain('env["VITE_EUT_HTTP_PRESENCE_ADMIN_READ"] === "enabled"');
    expect(adapter).toContain("HTTP_PRESENCE_INGEST_ENABLED && HTTP_PRESENCE_ADMIN_READ_ENABLED");
  });
});
