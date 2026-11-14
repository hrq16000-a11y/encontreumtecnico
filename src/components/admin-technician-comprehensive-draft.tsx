import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  prepareAdminTechnicianEdit,
  type AdminCatalog,
  type AdminCity,
  type PhoneChange,
} from "@/lib/admin-technician-crud-intent";
import { dddFromBrazilPhone, verifiedBaseCity } from "@/lib/admin-technician-geo";
import { buildProposedTechnicianChangeArgs } from "@/lib/admin-technician-rpc-payload";
import { BRAZIL_STATES } from "@/lib/service-taxonomy";

export type AdminTechnicianAdvancedRecord = Pick<
  Tables<"technicians">,
  | "id"
  | "display_name"
  | "status"
  | "updated_at"
  | "city"
  | "state_uf"
  | "neighborhood"
  | "specialties"
  | "service_slugs"
  | "coverage_city_ids"
  | "service_radius_km"
>;

type Preview = {
  city: string;
  uf: string;
  coverage: number;
  categories: number;
  services: number;
  phoneChanged: boolean;
  phoneLast4: string | null;
};

const input =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground";
const button =
  "min-h-11 rounded-lg border border-input px-3 text-sm text-foreground disabled:opacity-50";

export function AdminTechnicianComprehensiveDraft({
  technician,
  onClose,
  onSaved,
}: {
  technician: AdminTechnicianAdvancedRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(technician.display_name);
  const [catalog, setCatalog] = useState<AdminCatalog>({
    cities: [],
    categories: [],
    services: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uf, setUf] = useState(technician.state_uf ?? "");
  const [cityQuery, setCityQuery] = useState("");
  const [cityOptions, setCityOptions] = useState<AdminCity[]>([]);
  const [baseCityId, setBaseCityId] = useState(0);
  const [coverage, setCoverage] = useState<number[]>(
    technician.status === "aprovado" ? (technician.coverage_city_ids ?? []) : [],
  );
  const [radius, setRadius] = useState<number | null>(
    technician.status === "aprovado" ? technician.service_radius_km : null,
  );
  const [neighborhood, setNeighborhood] = useState(technician.neighborhood ?? "");
  const [categories, setCategories] = useState<string[]>(technician.specialties ?? []);
  const [services, setServices] = useState<string[]>(technician.service_slugs ?? []);
  const [reason, setReason] = useState("");
  const [phoneMode, setPhoneMode] = useState<"keep" | "replace" | "remove">("keep");
  const [phoneInput, setPhoneInput] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const initialCities = technician.coverage_city_ids ?? [];
      const [categoryResult, serviceResult, cityResult, baseResult] = await Promise.all([
        supabase.from("eut_service_categories").select("slug,label,active").order("slug"),
        supabase.from("eut_service_types").select("slug,category_slug,label,active").order("slug"),
        initialCities.length
          ? supabase.from("eut_ibge_municipalities").select("id,name,uf").in("id", initialCities)
          : Promise.resolve({ data: [] as AdminCity[], error: null }),
        technician.state_uf
          ? supabase
              .from("eut_ibge_municipalities")
              .select("id,name,uf")
              .eq("uf", technician.state_uf)
              .eq("name", technician.city)
              .limit(5)
          : Promise.resolve({ data: [] as AdminCity[], error: null }),
      ]);
      if (!active) return;
      if (categoryResult.error || serviceResult.error || cityResult.error || baseResult.error) {
        setLoadError(
          "Não foi possível verificar todos os catálogos administrativos. Prévia indisponível.",
        );
      } else {
        const knownCities = [...(cityResult.data ?? []), ...(baseResult.data ?? [])] as AdminCity[];
        const verified = verifiedBaseCity(technician.city, technician.state_uf, knownCities);
        setBaseCityId(verified?.id ?? 0);
        setCatalog({
          categories: categoryResult.data ?? [],
          services: serviceResult.data ?? [],
          cities: [...new Map(knownCities.map((city) => [city.id, city])).values()],
        });
      }
      setLoading(false);
    })().catch(() => {
      if (active) {
        setLoadError("Falha de comunicação com o catálogo IBGE.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [technician]);

  useEffect(() => {
    let active = true;
    const term = cityQuery.trim().replace(/[%_]/g, "");
    if (!uf || term.length < 2) {
      setCityOptions([]);
      return;
    }
    const id = window.setTimeout(() => {
      void supabase
        .from("eut_ibge_municipalities")
        .select("id,name,uf")
        .eq("uf", uf)
        .ilike("name", `%${term}%`)
        .order("name")
        .limit(20)
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setLoadError("Não foi possível pesquisar os municípios oficiais.");
          else {
            const matches = (data ?? []) as AdminCity[];
            setCityOptions(matches);
            setCatalog((current) => ({
              ...current,
              cities: [
                ...new Map([...current.cities, ...matches].map((city) => [city.id, city])).values(),
              ],
            }));
          }
        });
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [uf, cityQuery]);

  const knownCity = (id: number) => catalog.cities.find((city) => city.id === id);
  const approved = technician.status === "aprovado";
  const availableCategories = catalog.categories.filter((category) => category.active);
  const availableServices = catalog.services.filter(
    (service) =>
      service.active &&
      categories.includes(service.category_slug) &&
      availableCategories.some((category) => category.slug === service.category_slug),
  );
  const unavailableCategories = categories.filter(
    (slug) => !availableCategories.some((category) => category.slug === slug),
  );
  const unavailableServices = services.filter(
    (slug) => !availableServices.some((service) => service.slug === slug),
  );

  function selectBase(city: AdminCity) {
    setBaseCityId(city.id);
    setUf(city.uf);
    if (approved)
      setCoverage((current) => [city.id, ...current.filter((id) => id !== city.id)].slice(0, 5));
    setPreview(null);
  }

  async function saveChanges(event: FormEvent) {
    event.preventDefault();
    if (loading || loadError || busy) return;
    setResultMessage(null);
    const phone: PhoneChange =
      phoneMode === "replace"
        ? { kind: "replace", input: phoneInput, allowPaidContact: false }
        : { kind: phoneMode };
    const result = prepareAdminTechnicianEdit(
      {
        technicianId: technician.id,
        expectedUpdatedAt: technician.updated_at,
        reason,
        displayName,
        baseCityId,
        coverageCityIds: approved ? coverage : [],
        radiusKm: approved ? radius : null,
        neighborhood,
        categorySlugs: categories,
        serviceSlugs: services,
        phone,
      },
      catalog,
      {
        technicianStatus: technician.status,
        // Without a server-side status snapshot, paid-contact activation is prohibited.
        accountBlocked: true,
        phoneBlocked: true,
      },
    );
    if (!result.ok) {
      setIssues(result.issues);
      setPreview(null);
      return;
    }
    setIssues([]);
    setPreview({
      city: result.value.changes.city ?? technician.city,
      uf: result.value.changes.uf ?? technician.state_uf ?? "",
      coverage: result.value.auditPreview.coverageCityCount,
      categories: result.value.changes.categorySlugs.length,
      services: result.value.auditPreview.serviceCount,
      phoneChanged: result.value.auditPreview.phoneChanged,
      phoneLast4: result.value.auditPreview.phoneLast4,
    });
    if (!window.confirm(`Confirmar gravação auditada de ${displayName.trim()}? O contato privado não será exibido nem liberado para venda.`)) return;
    setBusy(true);
    try {
      // Auth and authorization are enforced again inside SECURITY DEFINER RPC.
      // No private number is logged, rendered, or saved to client storage.
      const db = supabase as unknown as SupabaseClient;
      const { data, error } = await db.rpc("eut_admin_technician_change", buildProposedTechnicianChangeArgs(result.value));
      if (error) throw error;
      if (!data || data.ok !== true || data.technician_id !== technician.id || !data.updated_at)
        throw new Error("O servidor não confirmou a gravação auditada.");
      setPhoneInput("");
      setPhoneMode("keep");
      setReason("");
      setResultMessage("Alterações gravadas e auditadas. A autorização do contato pago foi preservada.");
      onSaved();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setResultMessage(detail.includes("Could not find the function") || detail.includes("PGRST202")
        ? "A função administrativa ainda não está instalada no banco. Não houve gravação; é necessária homologação e autorização de SQL de produção."
        : "Gravação não confirmada. Recarregue o registro antes de tentar novamente. " + detail.slice(0, 150));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Revisão completa de cadastro de técnico"
      className="mt-5 min-w-0 rounded-2xl border-2 border-primary/30 bg-card p-3 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">Revisão avançada: {technician.display_name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nome, município IBGE, cobertura, categorias, serviços e contato privado. A gravação
            exige a função transacional auditada instalada e permissão administrativa no servidor.
          </p>
        </div>
        <button type="button" onClick={onClose} className={button}>
          Fechar
        </button>
      </div>
      {loading && (
        <p role="status" className="mt-3 text-sm">
          Carregando catálogos…
        </p>
      )}
      {loadError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {loadError}
        </p>
      )}
      {!loading && (
        <form className="mt-5 space-y-5" onSubmit={(event) => void saveChanges(event)}>
          <label className="grid gap-1 text-sm font-semibold">
            Nome profissional
            <input className={input} required minLength={3} maxLength={80} value={displayName}
              onChange={(event) => { setDisplayName(event.target.value); setPreview(null); }} />
          </label>
          <fieldset className="grid gap-3 md:grid-cols-2">
            <legend className="mb-3 font-semibold">Localização oficial</legend>
            <label className="grid gap-1 text-sm">
              UF de pesquisa
              <select
                className={input}
                value={uf}
                onChange={(event) => {
                  setUf(event.target.value);
                  setBaseCityId(0);
                  setCityQuery("");
                  setCityOptions([]);
                  setPreview(null);
                }}
              >
                <option value="">Selecione UF</option>
                {BRAZIL_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Pesquisar município no IBGE
              <input
                className={input}
                value={cityQuery}
                maxLength={100}
                placeholder="Digite pelo menos 2 letras"
                onChange={(event) => setCityQuery(event.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground">
                Cidade-base: {knownCity(baseCityId)?.name ?? "manter localidade existente sem inferência"}{" "}
                {knownCity(baseCityId)?.uf ?? ""}. A cidade nunca é inferida pelo DDD.
              </p>
              {cityOptions.length > 0 && (
                <ul className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-auto">
                  {cityOptions.map((city) => (
                    <li key={city.id}>
                      <button type="button" className={button} onClick={() => selectBase(city)}>
                        {city.name}/{city.uf} · IBGE {city.id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="grid gap-1 text-sm md:col-span-2">
              Bairro declarado
              <input
                className={input}
                value={neighborhood}
                maxLength={100}
                onChange={(event) => {
                  setNeighborhood(event.target.value);
                  setPreview(null);
                }}
              />
            </label>
          </fieldset>
          {approved && (
            <fieldset className="space-y-3">
              <legend className="font-semibold">Municípios atendidos (até 5)</legend>
              <ul className="flex flex-wrap gap-2">
                {coverage.map((id) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"
                  >
                    {knownCity(id)?.name ?? `IBGE ${id}`} / {knownCity(id)?.uf ?? "UF a verificar"}
                    <button
                      type="button"
                      disabled={id === baseCityId}
                      className="text-destructive disabled:opacity-40"
                      onClick={() => {
                        setCoverage((current) => current.filter((item) => item !== id));
                        setPreview(null);
                      }}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {cityOptions
                  .filter((city) => !coverage.includes(city.id))
                  .map((city) => (
                    <button
                      type="button"
                      key={city.id}
                      disabled={coverage.length >= 5}
                      className={button}
                      onClick={() => {
                        setCoverage((current) => [...current, city.id]);
                        setPreview(null);
                      }}
                    >
                      + {city.name}/{city.uf}
                    </button>
                  ))}
              </div>
              <label className="grid max-w-xs gap-1 text-sm">
                Raio de atendimento
                <select
                  className={input}
                  value={radius ?? ""}
                  onChange={(event) => {
                    setRadius(event.target.value ? Number(event.target.value) : null);
                    setPreview(null);
                  }}
                >
                  <option value="">Sem raio definido</option>
                  {[5, 10, 20, 30, 50, 75, 100, 150, 200, 300].map((km) => (
                    <option key={km} value={km}>
                      {km} km
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
          <fieldset className="space-y-3">
            <legend className="font-semibold">Especialidades (categorias)</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableCategories.map((category) => (
                <label key={category.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={categories.includes(category.slug)}
                    onChange={(event) => {
                      setCategories((current) =>
                        event.target.checked
                          ? [...current, category.slug]
                          : current.filter((slug) => slug !== category.slug),
                      );
                      if (!event.target.checked)
                        setServices((current) =>
                          current.filter(
                            (slug) =>
                              catalog.services.find((service) => service.slug === slug)
                                ?.category_slug !== category.slug,
                          ),
                        );
                      setPreview(null);
                    }}
                  />
                  {category.label ?? category.slug}
                </label>
              ))}
            </div>
            {unavailableCategories.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 p-3 text-sm">
                <p className="font-semibold">Especialidades antigas ou inativas: revisar</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {unavailableCategories.map((slug) => (
                    <li key={slug}>
                      <button
                        type="button"
                        className={button}
                        onClick={() => {
                          setCategories((current) => current.filter((item) => item !== slug));
                          setServices((current) =>
                            current.filter(
                              (item) =>
                                catalog.services.find((service) => service.slug === item)
                                  ?.category_slug !== slug,
                            ),
                          );
                          setPreview(null);
                        }}
                      >
                        Remover {slug}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="font-semibold">Serviços vinculados</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableServices.map((service) => (
                <label key={service.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={services.includes(service.slug)}
                    onChange={(event) => {
                      setServices((current) =>
                        event.target.checked
                          ? [...current, service.slug]
                          : current.filter((slug) => slug !== service.slug),
                      );
                      setPreview(null);
                    }}
                  />
                  {service.label ?? service.slug}
                </label>
              ))}
            </div>
            {availableServices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Selecione especialidades ativas para ver serviços.
              </p>
            )}
            {unavailableServices.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 p-3 text-sm">
                <p className="font-semibold">Serviços antigos ou incompatíveis: revisar</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {unavailableServices.map((slug) => (
                    <li key={slug}>
                      <button
                        type="button"
                        className={button}
                        onClick={() => {
                          setServices((current) => current.filter((item) => item !== slug));
                          setPreview(null);
                        }}
                      >
                        Remover {slug}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </fieldset>
          <fieldset className="space-y-3 rounded-lg border border-border p-3">
            <legend className="font-semibold">Contato privado — sem exposição pública</legend>
            <p className="text-xs text-muted-foreground">
              O telefone atual não é consultado nem exibido aqui. Substituir/remover exige RPC
              auditada; a opção de contato pago permanece desabilitada. Contatos suspensos não são liberados.
            </p>
            <label className="grid max-w-sm gap-1 text-sm">
              Ação proposta
              <select
                className={input}
                value={phoneMode}
                onChange={(event) => {
                  setPhoneMode(event.target.value as typeof phoneMode);
                  setPhoneInput("");
                  setPreview(null);
                }}
              >
                <option value="keep">Manter como está</option>
                <option value="replace">Propor substituição</option>
                <option value="remove">Propor remoção do contato</option>
              </select>
            </label>
            {phoneMode === "replace" && (
              <label className="grid max-w-sm gap-1 text-sm">
                Novo número brasileiro com DDD
                <input
                  className={input}
                  type="tel"
                  autoComplete="off"
                  value={phoneInput}
                  maxLength={25}
                  onChange={(event) => {
                    setPhoneInput(event.target.value);
                    setPreview(null);
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  DDD identificado: {dddFromBrazilPhone(phoneInput) ?? "a validar"} — DDD não
                  determina cidade de atendimento.
                </span>
              </label>
            )}
          </fieldset>
          <label className="grid gap-1 text-sm">
            Justificativa administrativa (obrigatória)
            <textarea
              className={input}
              rows={2}
              minLength={8}
              maxLength={400}
              required
              value={reason}
              placeholder="Motivo da revisão; não informe telefone nem dados privados"
              onChange={(event) => {
                setReason(event.target.value);
                setPreview(null);
              }}
            />
          </label>
          {resultMessage && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">{resultMessage}</p>}
          {issues.length > 0 && (
            <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {preview && (
            <div
              role="status"
              className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"
            >
              <strong>Dados validados para envio administrativo</strong>
              <p>
                {preview.city}/{preview.uf} · {preview.coverage} cidades · {preview.categories}{" "}
                categorias · {preview.services} serviços.
              </p>
              <p>
                {preview.phoneChanged
                  ? `Contato proposto para alteração${preview.phoneLast4 ? ` (final ${preview.phoneLast4})` : ""}.`
                  : "Contato preservado."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">A confirmação de sucesso depende do retorno do banco.</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading || busy || Boolean(loadError)}
            className="min-h-12 w-full rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40 sm:w-auto"
          >
            {busy ? "Gravando e auditando…" : "Salvar alterações no banco"}
          </button>
        </form>
      )}
    </section>
  );
}
