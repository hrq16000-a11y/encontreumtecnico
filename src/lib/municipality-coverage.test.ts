import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { localMatchLabel, localMatchLevel, rankTechniciansByDeclaredArea } from "./technician-local-ranking";

const read = (path: string) => readFileSync(path, "utf8");
const lines = read("data/municipios-ibge-20261110.csv").trim().split(/\r?\n/).slice(1);
const municipalities = lines.map((line) => {
  const [id, name, uf, latitude, longitude] = line.split(",");
  return { id: Number(id), name, uf, latitude: Number(latitude), longitude: Number(longitude) };
});
const sql = read("docs/sql/eut-verified-city-coverage-avatars-20261110.sql");

describe("cidades IBGE, raio e avatar do técnico", () => {
  it("contém 5571 municípios reais com código IBGE único, UF, nome e centro de referência", () => {
    expect(municipalities).toHaveLength(5571);
    expect(new Set(municipalities.map((m) => m.id)).size).toBe(5571);
    expect(municipalities.every((m) =>
      Number.isInteger(m.id) && m.id >= 1000000 && m.id <= 9999999
      && Boolean(m.name && m.uf?.length === 2)
      && m.latitude >= -35 && m.latitude <= 6
      && m.longitude >= -75 && m.longitude <= -30)).toBe(true);
    for (const city of [
      { id: 4106902, name: "Curitiba", uf: "PR" },
      { id: 4125506, name: "São José dos Pinhais", uf: "PR" },
      { id: 4218707, name: "Tubarão", uf: "SC" },
    ]) {
      expect(municipalities.find((m) => m.id === city.id)).toMatchObject(city);
    }
  });

  it("rejeita nomes livres e códigos inexistentes no servidor", () => {
    for (const clause of [
      "eut_ibge_municipalities_public_select",
      "ALTER TABLE public.eut_ibge_municipalities ENABLE ROW LEVEL SECURITY",
      "FROM public.eut_ibge_municipalities m",
      "Selecione um município válido do catálogo IBGE",
      "NEW.city := canonical_name",
      "CREATE TRIGGER eut_technician_city_coverage_guard",
      "REVOKE ALL ON FUNCTION public.eut_validate_technician_city_and_coverage",
    ]) expect(sql).toContain(clause);
    const picker = read("src/components/municipality-picker.tsx");
    expect(picker).toContain("onSelect(found)");
    expect(picker).toContain("selectedId");
    expect(read("src/lib/technician-registration-wizard.ts")).toContain("base_city_ibge_id");
  });

  it("limita as cidades a cinco, incluindo a base, sem alterar status ou titularidade", () => {
    for (const clause of [
      "eut_technician_coverage_max_five",
      "cardinality(coverage_city_ids) <= 5",
      "n<1 OR n>5",
      "array_position(v_codes,NULL) IS NOT NULL",
      "matched <> cardinality(NEW.coverage_city_ids)",
      "expected_id=ANY(NEW.coverage_city_ids)",
      "t.user_id=v_uid AND t.status='aprovado'",
      "GRANT EXECUTE ON FUNCTION public.eut_set_my_technician_coverage",
    ]) expect(sql).toContain(clause);
    expect(sql).not.toMatch(/SET\s+status='aprovado'/);
    expect(read("src/components/technician-coverage-editor.tsx")).toContain("extras.length < 4");
  });

  it("prioriza cidade-base e cidades adicionais, sem inferir bairros ou distâncias GPS", () => {
    const declared = { id: "a", city: "Tubarão", state_uf: "SC", neighborhood: "Centro",
      online_now: false, coverage_cities: [
        { id: 4106902, name: "Curitiba", uf: "PR" },
        { id: 4218707, name: "Tubarão", uf: "SC" },
      ] };
    expect(localMatchLevel(declared, { uf: "PR", cidade: "Curitiba", bairro: "Centro" })).toBe(2);
    expect(localMatchLabel(declared, { uf: "PR", cidade: "Curitiba", bairro: "Centro" }))
      .toBe("Cidade atendida declarada");
    const others = { id: "b", city: "Florianópolis", state_uf: "SC",
      neighborhood: "Centro", online_now: true };
    expect(rankTechniciansByDeclaredArea([others, declared], {
      uf: "PR", cidade: "Curitiba", bairro: "Centro",
    }).map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("restringe foto ao proprietário com consentimento e fallback por iniciais", () => {
    for (const clause of [
      "'eut-technician-avatars',true,2097152",
      "bucket_id='eut-technician-avatars'",
      "split_part(name,'/',2)=(SELECT auth.uid()::text)",
      "eut_technician_avatar_owner_insert",
      "eut_set_my_technician_avatar",
      "NOT EXISTS (SELECT 1 FROM storage.objects",
    ]) expect(sql).toContain(clause);
    const avatar = read("src/components/technician-avatar.tsx");
    const upload = read("src/components/technician-avatar-editor.tsx");
    expect(avatar).toContain("<AvatarFallback");
    expect(avatar).toContain("SAFE_PATH");
    expect(upload).toContain("accepted");
    expect(upload).toContain("onClick={() => void upload()}");
    expect(upload).toContain("crypto.randomUUID()");
    expect(upload).not.toContain("service_role");
  });
});
