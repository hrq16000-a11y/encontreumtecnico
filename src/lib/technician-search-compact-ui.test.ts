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
    expect(page).toContain('onClick={() => setShowAdvanced(value => !value)}');
    expect(page).toContain('className={showAdvanced ? "mt-3 grid');
    expect(page).toContain('motion-reduce:transition-none');
  });

  it("mantém os debounced filters montados, e não perde as regras de URL e região", () => {
    expect(page).toContain('technicianSearchAfterUfChange(value, search.prioridade)');
    expect(page).toContain('key={`filtro-cidade-${search.uf}-${filterResetRevision}`}');
    expect(page).toContain('key={`filtro-bairro-${search.uf}-${filterResetRevision}`}');
    expect(page).toContain('key={`filtro-regiao-${search.uf}-${filterResetRevision}`}');
    expect(page).toContain('trackFilter("especialidade", value)');
    expect(page).toContain('trackFilter("uf", value)');
    expect(page).toContain('prioridade: event.target.checked ? "regiao" : ""');
    expect(page).toContain('localMatchLabel(t,');
    expect(page).toContain('listApprovedTechnicians({ data: deps })');
    expect(page).toContain('Limpar filtros');
    expect(page).toContain('onClick={clearAllFilters}');
    const clearStart = page.indexOf('const clearAllFilters =');
    const clearAction = page.slice(clearStart, page.indexOf('return (', clearStart));
    expect(clearAction).toContain('clearDirectoryPendingFilters();');
    expect(clearAction).toContain('update({ especialidade: "Todas", servico: "", uf: "", cidade: "", bairro: "", regiao: "", prioridade: "" });');
    expect(clearAction).toContain('setFilterResetRevision(value => value + 1)');
    expect(page).toContain('setShowAdvanced(true)');
  });

  it("coloca resultados antes das orientações e evita avisos duplicados", () => {
    const cards = page.indexOf('<TechnicianSearchCard');
    const tally = page.indexOf('aria-live="polite"');
    const context = page.indexOf('aria-label="Orientações da especialidade selecionada"');
    expect(tally).toBeGreaterThan(0);
    expect(cards).toBeGreaterThan(tally);
    expect(context).toBeGreaterThan(cards);
    expect(page).not.toContain('aria-label="Transparência e confiança na busca"');
    expect(page).toContain("Contatos particulares continuam protegidos");
    expect(page).not.toContain("CustomerLocationButton");
    expect(page).toContain('<SponsoredPublicSlot slotKey="search.top"');
    expect(page).toContain('<LegacyPublicArchive show={canShowLegacyArchive(search)} />');
    expect(page).toContain("Em todo o Brasil");
    expect(page).toContain("Perfis públicos declarados");
  });

  it("recupera paginação vazia sem confundir com ausência de técnicos ou abrir convite automático", () => {
    expect(page).toContain("search.pagina > 1 ? (");
    expect(page).toContain("Esta página da busca não tem resultados");
    expect(page).toContain('onClick={() => void update({ pagina: 1 })}');
    expect(page).toContain("Voltar à primeira página");
    expect(page).toContain("if (technicians.length > 0 || !searchArea || search.pagina > 1) return;");
    expect(page).toContain("search.servico, search.pagina]);");
    expect(page).toContain('title="Nenhum técnico encontrado com estes filtros"');
  });

  it("preserva foto real e apenas sinais factuais, sem telefone ou avaliações inventadas", () => {
    expect(card).toContain('avatarPath={t.avatar_path}');
    expect(card).toContain('params={{ tecnicoId: t.public_slug }}');
    expect(card).toContain('aria-label={"Ver perfil e serviços de " + t.display_name}');
    expect(card).toContain('t.online_now');
    expect(card).toContain('Atividade recente, sem garantia de disponibilidade');
    expect(card).toContain('t.referral_highlight');
    expect(card).toContain('Destaque por indicações');
    expect(card).toContain('t.service_slugs.slice(0, 3)');
    expect(card).toContain('formatPublicLocation(t)');
    expect(card).not.toContain('t.pioneer_bronze');
    expect(card).toContain("Ver perfil completo");
    expect(card).toContain('motion-reduce:transition-none');
    expect(card).not.toMatch(/href=["'](?:tel:|mailto:|https?:\/\/wa\.me)/i);
    expect(card).not.toContain('t.phone_number');
  });
});
