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

  it("usa somente canal privado e exige ativação explícita após a política", () => {
    expect(publisher).toContain("config: { private: true }");
    expect(observer).toContain("config: { private: true }");
    expect(root).toContain("PRIVATE_VISITOR_PRESENCE_ENABLED && !hasRouteError");
    expect(readFileSync("src/lib/visitor-realtime-presence.ts", "utf8"))
      .toContain('env["VITE_EUT_PRIVATE_REALTIME_PRESENCE"] === "enabled"');
  });
});
