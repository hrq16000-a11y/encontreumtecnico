import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MunicipalityPicker } from "@/components/municipality-picker";
import { useActiveCategories } from "@/hooks/use-active-categories";
import { useActiveServices } from "@/hooks/use-active-services";
import type { Municipality } from "@/hooks/use-municipalities";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";
import { prepareAdminCatalogEdit } from "@/lib/admin-catalog-edit";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

export type AdminCatalogTechnician = {
  id: string; display_name: string; status: string;
  city: string; state_uf: string | null; updated_at: string;
  specialties: string[]; service_slugs: string[]; coverage_city_ids: number[];
};

export function AdminTechnicianCatalogEditor({ technician, onSaved, onCancel }: {
  technician: AdminCatalogTechnician;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { categories, loading: categoriesLoading, error: categoriesError } = useActiveCategories();
  const { services, loading: servicesLoading, error: servicesError } = useActiveServices();
  const [uf, setUf] = useState(technician.state_uf ?? "");
  const [city, setCity] = useState<Municipality | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([...technician.specialties]);
  const [serviceSlugs, setServiceSlugs] = useState<string[]>([...technician.service_slugs]);
  const [replaceCoverage, setReplaceCoverage] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const catalogReady = !categoriesLoading && !servicesLoading && !categoriesError && !servicesError;
  const invalidSpecialties = specialties.filter((slug) => !categories.some((item) => item.slug === slug));
  const invalidServices = serviceSlugs.filter((slug) => !services.some((item) => item.slug === slug && specialties.includes(item.category_slug)));
  const cityOutsideCoverage = technician.status === "aprovado" && city && !technician.coverage_city_ids.includes(city.id);
  const cityChanged = city && (city.name !== technician.city || city.uf !== technician.state_uf);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !catalogReady) return;
    const prepared = prepareAdminCatalogEdit({
      technicianId: technician.id, expectedUpdatedAt: technician.updated_at,
      technicianStatus: technician.status, previousCity: technician.city,
      previousUf: technician.state_uf, existingCoverage: technician.coverage_city_ids,
      city, specialties, serviceSlugs, replaceCoverage, reason,
    }, categories.map(({ slug }) => ({ slug, active: true })),
    services.map(({ slug, category_slug }) => ({ slug, category_slug, active: true })));
    if (!prepared.ok) { setMessage(prepared.issue); return; }
    const { payload, coverageReplaced } = prepared;
    if (!window.confirm(
      `Confirmar atualização administrativa de ${technician.display_name}? ` +
      `Cidade: ${city?.name}/${city?.uf}; especialidades: ${specialties.length}; serviços: ${serviceSlugs.length}. ` +
      (coverageReplaced ? "A cobertura anterior será substituída pela nova cidade. " : "") +
      (cityChanged ? "O raio de atendimento será redefinido. " : "") +
      "A operação será auditada."
    )) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await db.rpc("eut_admin_technician_catalog_edit", payload);
      if (error) throw error;
      if (data?.ok !== true || data?.technician_id !== technician.id || !data?.updated_at)
        throw new Error("O servidor não confirmou a alteração.");
      onSaved();
    } catch (error) {
      setMessage("Não foi possível salvar. " + (error instanceof Error ? error.message.slice(0, 180) : "Atualize a tela."));
    } finally { setBusy(false); }
  }

  return <form onSubmit={(event) => void submit(event)}
    className="mt-5 space-y-4 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm sm:p-5"
    aria-label="Editar cidade e especialidades do técnico">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-bold text-foreground">Cadastro territorial e especialidades</h3>
        <p className="mt-1 text-sm text-muted-foreground">{technician.display_name} · {technician.city}/{technician.state_uf ?? "UF pendente"}</p>
      </div>
      <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-input px-4 text-sm">Cancelar</button>
    </div>
    <label className="grid gap-1 text-sm font-semibold text-foreground">Unidade federativa
      <select value={uf} required onChange={(event) => {
        setUf(event.target.value); setCity(null); setReplaceCoverage(false);
      }} className="min-h-11 rounded-lg border border-input bg-background px-3 text-base">
        <option value="">Selecione a UF</option>
        {BRAZIL_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
      </select>
    </label>
    <MunicipalityPicker uf={uf} selectedId={city?.id ?? null}
      currentCityName={uf === technician.state_uf ? technician.city : ""}
      onSelect={(selected) => { setCity(selected); setReplaceCoverage(false); }} />
    {cityChanged && <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-foreground">
      A alteração da cidade-base redefine o raio de atendimento. Os demais dados privados não são alterados.
    </p>}
    {cityOutsideCoverage && <label className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-foreground">
      <input type="checkbox" checked={replaceCoverage} onChange={(event) => setReplaceCoverage(event.target.checked)}
        className="mt-1 h-4 w-4" />
      <span>Confirmo substituir a cobertura anterior pela nova cidade-base. O raio de atendimento será redefinido; não ampliaremos automaticamente outras localidades.</span>
    </label>}
    <fieldset disabled={!catalogReady || busy} className="space-y-2">
      <legend className="text-sm font-bold text-foreground">Especialidades ativas</legend>
      {categoriesLoading ? <p className="text-sm text-muted-foreground">Carregando categorias…</p> :
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => <label key={category.slug} className="flex min-h-10 items-center gap-2 rounded-lg border border-border p-2 text-sm">
            <input type="checkbox" checked={specialties.includes(category.slug)}
              onChange={(event) => {
                const next = event.target.checked ? [...specialties, category.slug] : specialties.filter((slug) => slug !== category.slug);
                setSpecialties(next);
                setServiceSlugs((current) => current.filter((slug) => services.some((item) => item.slug === slug && next.includes(item.category_slug))));
              }} />{category.label}
          </label>)}
        </div>}
    </fieldset>
    {catalogReady && invalidSpecialties.length > 0 && <button type="button" disabled={busy}
      onClick={() => setSpecialties((current) => current.filter((slug) => categories.some((item) => item.slug === slug)))}
      className="min-h-10 rounded-lg border border-amber-500 px-3 text-sm font-semibold">
      Remover {invalidSpecialties.length} especialidade(s) inativa(s) do rascunho
    </button>}
    <fieldset disabled={!catalogReady || busy} className="space-y-2">
      <legend className="text-sm font-bold text-foreground">Serviços associados</legend>
      <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
        {services.filter((item) => specialties.includes(item.category_slug)).map((service) =>
          <label key={service.slug} className="flex min-h-10 items-center gap-2 rounded-lg border border-border p-2 text-sm">
            <input type="checkbox" checked={serviceSlugs.includes(service.slug)}
              onChange={(event) => setServiceSlugs((current) => event.target.checked
                ? [...current, service.slug] : current.filter((slug) => slug !== service.slug))} />{service.label}
          </label>)}
      </div>
    </fieldset>
    {catalogReady && invalidServices.length > 0 && <button type="button" disabled={busy}
      onClick={() => setServiceSlugs((current) => current.filter((slug) => services.some((item) => item.slug === slug && specialties.includes(item.category_slug))))}
      className="min-h-10 rounded-lg border border-amber-500 px-3 text-sm font-semibold">
      Remover {invalidServices.length} serviço(s) incompatível(is) do rascunho
    </button>}
    {(categoriesError || servicesError) && <p role="alert" className="text-sm text-destructive">Catálogo indisponível. Nenhuma alteração será enviada.</p>}
    <label className="grid gap-1 text-sm font-semibold text-foreground">Justificativa administrativa obrigatória
      <textarea required minLength={8} maxLength={400} rows={3} value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Motivo da correção, sem telefone, e-mail ou outros contatos"
        className="rounded-lg border border-input bg-background p-3 text-base" />
    </label>
    <p className="text-xs leading-5 text-muted-foreground">
      A cidade é confirmada pelo código oficial IBGE. O DDD pode ajudar na triagem regional, mas não comprova o município exato.
      Contatos privados, pagamentos, identidade e bloqueios não são editados aqui.
    </p>
    {message && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{message}</p>}
    <button type="submit" disabled={busy || !catalogReady || !city}
      className="min-h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
      {busy ? "Registrando no banco…" : "Confirmar edição auditada"}
    </button>
  </form>;
}
