import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync("src/routes/tecnicos.index.tsx", "utf8");
const card = readFileSync("src/components/technician-search-card.tsx", "utf8");

describe("Busca compacta: filtros e perfis com privacidade", () => {
  it("mostra especialidade, UF e cidade antes das opções avançadas", () => {
    const start = page.indexOf('aria-label="Filtros da busca"');
    const advanced = page.indexOf('id="filtros-avancados"');
    const specialty = page.indexOf('id="filtro-especialidade"', start);
    const state = page.indexOf('id="filtro-uf"', start);
    const city = page.indexOf('id="filtro-cidade"', start);
    expect(start).toBeGreaterThan(0);
    expect(specialty).toBeGreaterThan(start);
    expect(state).toBeGreaterThan(specialty);
    expect(city).toBeGreaterThan(state);
    expect(advanced).toBeGreaterThan(city);
    for (const id of ['filtro-servico', 'filtro-bairro', 'filtro-regiao']) {
      expect(page.indexOf('id="' + id + '"')).toBeGreaterThan(advanced);
    }
    expect(page).toContain('aria-expanded={showAdvanced}');
    expect(page).toContain('aria-controls="filtros-avancados"');
    expect(page).toContain('advancedClosedByUser.current = showAdvanced');
    expect(page).toContain('if (!advancedClosedByUser.current &&');
    expect(page).toContain('setShowAdvanced(value => !value)');
    expect(page).toContain('aria-hidden={!showAdvanced} inert={!showAdvanced}');
    expect(page).toContain('grid-rows-[1fr] opacity-100');
    expect(page).toContain('grid-rows-[0fr] opacity-0');
    expect(page).toContain('min-h-0 overflow-hidden');
    expect(page).toContain('motion-reduce:transition-none motion-reduce:duration-0');
  });

  it("mantém os debounced filters montados, e não perde as regras de URL e região", () => {
    expect(page).toContain('technicianSearchAfterUfChange(e.target.value, search.prioridade)');
    expect(page).toContain('key={`filtro-cidade-${search.uf}`}');
    expect(page).toContain('key={`filtro-bairro-${search.uf}`}');
    expect(page).toContain('key={`filtro-regiao-${search.uf}`}');
    expect(page).toContain('trackFilter("especialidade", e.target.value)');
    expect(page).toContain('trackFilter("uf", e.target.value)');
    expect(page).toContain('prioridade: event.target.checked ? "regiao" : ""');
    expect(page).toContain('localMatchLabel(t,');
    expect(page).toContain('listApprovedTechnicians({ data: deps })');
    expect(page).toContain('Limpar filtros');
    expect(page).toContain('setShowAdvanced(true)');
  });

  it("coloca resultados e cartões antes das notas longas sem remover publicidade e transparência", () => {
    const cards = page.indexOf('<TechnicianSearchCard');
    const tally = page.indexOf('aria-live="polite"');
    const context = page.indexOf('aria-label="Orientações da especialidade selecionada"');
    const trust = page.indexOf('aria-label="Transparência e confiança na busca"');
    expect(tally).toBeGreaterThan(0);
    expect(cards).toBeGreaterThan(tally);
    expect(context).toBeGreaterThan(cards);
    expect(trust).toBeGreaterThan(cards);
    expect(page).toContain('<SponsoredPublicSlot slotKey="search.top"');
    expect(page).toContain('<LegacyPublicArchive show={canShowLegacyArchive(search)} />');
    expect(page).toContain("Em todo o Brasil");
    expect(page).toContain("Perfis públicos declarados");
  });

  it("preserva foto real e selo factual, sem telefone ou avaliações inventadas", () => {
    expect(card).toContain('avatarPath={t.avatar_path}');
    expect(card).toContain('params={{ tecnicoId: t.public_slug }}');
    expect(card).toContain('aria-label={"Ver perfil e serviços de " + t.display_name}');
    expect(card).toContain('t.online_now');
    // Historical origin is not a public distinction; keep the removed badge out of cards.
    expect(card).not.toContain('t.pioneer_bronze');
    expect(card).not.toContain('Pioneiro Bronze');
    expect(card).not.toMatch(/(?:Origem:\s*(?:WordPress|legado)|Perfil\s+(?:importado|legado)|Migrado\s+do\s+WordPress)/i);
    expect(card).toContain('t.referral_highlight');
    expect(card).toContain('t.service_slugs.slice(0, 3)');
    expect(card).toContain("Contato privado protegido");
    expect(card).toContain("Ver perfil completo");
    expect(card).toContain('motion-reduce:transition-none');
    expect(card).not.toMatch(/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i);
    expect(card).not.toContain('t.phone_number');
  });
});
