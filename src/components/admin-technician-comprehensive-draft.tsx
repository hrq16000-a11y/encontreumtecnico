import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  prepareAdminTechnicianEdit,
  prepareReversibleArchive,
  type AdminCatalog,
  type AdminCity,
  type PhoneChange,
  type PreparedEdit,
} from "@/lib/admin-technician-crud-intent";
import {
  persistAdminTechnicianArchive,
  persistAdminTechnicianEdit,
  type AdminArchiveAction,
  type AdminCrudRpc,
} from "@/lib/admin-technician-crud-rpc";
import { dddFromBrazilPhone, verifiedBaseCity } from "@/lib/admin-technician-geo";
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
  const preparedRef = useRef<PreparedEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [archiveAction, setArchiveAction] = useState<AdminArchiveAction>("archive");
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const archivingRef = useRef(false);

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

  function previewChanges(event: FormEvent) {
    event.preventDefault();
    if (loading || loadError) return;
    preparedRef.current = null;
    setSaveError(null);
    const phone: PhoneChange =
      phoneMode === "replace"
        ? { kind: "replace", input: phoneInput, allowPaidContact: false }
        : { kind: phoneMode };
    const result = prepareAdminTechnicianEdit(
      {
        technicianId: technician.id,
        expectedUpdatedAt: technician.updated_at,
        reason,
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
    preparedRef.current = result.value;
    setPreview({
      city: result.value.changes.city,
      uf: result.value.changes.uf,
      coverage: result.value.auditPreview.coverageCityCount,
      categories: result.value.changes.categorySlugs.length,
      services: result.value.auditPreview.serviceCount,
      phoneChanged: result.value.auditPreview.phoneChanged,
      phoneLast4: result.value.auditPreview.phoneLast4,
    });
    // The raw phone never enters a persisted draft, browser storage or preview.
    setPhoneInput("");
    setPhoneMode("keep");
  }

  async function saveValidatedPreview() {
    const prepared = preparedRef.current;
    if (!prepared || !preview || savingRef.current || archivingRef.current) return;
    if (!window.confirm("Confirmar esta alteração administrativa auditada? A ação será gravada no banco e poderá modificar dados privados.")) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const rpc = (supabase as unknown as { rpc: AdminCrudRpc }).rpc.bind(supabase);
    const result = await persistAdminTechnicianEdit(rpc, prepared);
    // A contact number may exist only in short-lived component memory.
    preparedRef.current = null;
    setPreview(null);
    setPhoneInput("");
    setPhoneMode("keep");
    savingRef.current = false;
    setSaving(false);
    if (result.ok) {
      onSaved();
      return;
    }
    setSaveError(result.reason === "conflict"
      ? "Este cadastro foi alterado em outra sessão. Recarregue os dados antes de tentar novamente."
      : result.reason === "denied"
        ? "A sessão atual não possui permissão administrativa para esta alteração."
        : "A gravação não foi confirmada pelo servidor. Nenhuma alteração será considerada concluída; recarregue e confira antes de tentar novamente.");
  }

  async function submitArchive(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || archivingRef.current) return;
    setArchiveError(null);
    const validation = prepareReversibleArchive({
      technicianId: technician.id,
      expectedUpdatedAt: technician.updated_at,
      action: archiveAction,
      reason: archiveReason,
      // The private archive marker is server-only. The RPC verifies its real state.
      isArchived: null,
      accountBlocked: true,
      phoneBlocked: true,
    });
    if (!validation.ok) {
      setArchiveError(validation.issue);
      return;
    }
    const message = archiveAction === "archive"
      ? "Arquivar este técnico? O perfil será suspenso, sairá da cobertura ativa e o contato pago será desabilitado. Nome, telefone privado, histórico e bloqueios serão preservados."
      : "Solicitar restauração do arquivo? Só cadastros realmente arquivados podem ser restaurados. O registro voltará para PENDENTE, sem aprovação ou reativação do contato pago.";
    if (!window.confirm(message)) return;
    archivingRef.current = true;
    setArchiving(true);
    const rpc = (supabase as unknown as { rpc: AdminCrudRpc }).rpc.bind(supabase);
    const result = await persistAdminTechnicianArchive(rpc, {
      technicianId: technician.id,
      expectedUpdatedAt: technician.updated_at,
      action: archiveAction,
      reason: archiveReason.trim(),
    });
    archivingRef.current = false;
    setArchiving(false);
    if (result.ok) {
      setArchiveReason("");
      onSaved();
      return;
    }
    setArchiveError(result.reason === "conflict"
      ? "O técnico foi atualizado em outra sessão. Recarregue antes de tentar novamente."
      : result.reason === "denied"
        ? "Sua sessão não possui autorização administrativa para esta operação."
        : "A ação não foi confirmada. Verifique se o técnico já está arquivado (ou se é apenas um suspenso comum) e recarregue antes de tentar novamente.");
  }

  return (
    <section
      aria-label="Revisão completa de cadastro de técnico"
      className="mt-5 rounded-2xl border-2 border-primary/30 bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">Revisão avançada: {technician.display_name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Município IBGE, cobertura, categorias, serviços e contato privado. Confira a prévia
            antes de salvar; a gravação exige a função administrativa homologada no servidor.
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={saving || archiving} className={button}>
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
        <form className="mt-5 space-y-5" onSubmit={previewChanges}>
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
                Cidade-base: {knownCity(baseCityId)?.name ?? "não conciliada"}{" "}
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
              O telefone atual não é consultado nem exibido aqui. Substituir/remover depende de RPC
              auditada; a opção de contato pago permanece desabilitada.
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
          {issues.length > 0 && (
            <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          {preview && (
            <div
              role="status"
              className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"
            >
              <strong>Prévia validada — ainda não gravada</strong>
              <p>
                {preview.city}/{preview.uf} · {preview.coverage} cidades · {preview.categories}{" "}
                categorias · {preview.services} serviços.
              </p>
              <p>
                {preview.phoneChanged
                  ? `Contato proposto para alteração${preview.phoneLast4 ? ` (final ${preview.phoneLast4})` : ""}.`
                  : "Contato preservado."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                O servidor deve confirmar a alteração e registrar a auditoria. Se a RPC ainda não
                estiver instalada, a gravação será recusada; a prévia não altera o banco.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={loading || Boolean(loadError) || saving || archiving}
              className="min-h-11 w-full rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40 sm:w-auto"
            >
              Validar prévia sem gravar
            </button>
            {preview && <button type="button" disabled={saving || archiving}
              onClick={() => void saveValidatedPreview()}
              className="min-h-11 w-full rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40 sm:w-auto">
              {saving ? "Aguardando confirmação…" : "Salvar alteração auditada"}
            </button>}
          </div>
        </form>
      )}
      <form onSubmit={(event) => void submitArchive(event)} className="mt-6 space-y-3 rounded-xl border border-amber-500/40 p-4" aria-label="Arquivamento administrativo reversível">
        <h4 className="font-semibold text-foreground">Arquivar ou restaurar cadastro</h4>
        <p className="text-sm text-muted-foreground">
          Ações auditadas e sem exclusão definitiva. Arquivar suspende o perfil e desativa contato pago;
          restaurar exige um arquivo existente e retorna apenas à análise pendente. Contatos privados,
          bloqueios e histórico permanecem preservados.
        </p>
        <label className="grid gap-1 text-sm">
          Operação
          <select className={input} value={archiveAction} disabled={archiving || saving}
            onChange={(event) => {
              setArchiveAction(event.target.value as AdminArchiveAction);
              setArchiveError(null);
            }}>
            <option value="archive">Arquivar este cadastro</option>
            {technician.status === "suspenso" && <option value="restore">Restaurar do arquivo (se realmente arquivado)</option>}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Justificativa administrativa para esta operação
          <textarea className={input} value={archiveReason} required minLength={8} maxLength={400}
            rows={2} disabled={archiving || saving} placeholder="Motivo da ação; não inclua contatos privados"
            onChange={(event) => {
              setArchiveReason(event.target.value);
              setArchiveError(null);
            }} />
        </label>
        {archiveError && <p role="alert" className="text-sm text-destructive">{archiveError}</p>}
        <button type="submit" disabled={archiving || saving || loading}
          className="min-h-11 w-full rounded-lg border border-amber-500 bg-background px-5 text-sm font-semibold text-foreground disabled:opacity-40 sm:w-auto">
          {archiving ? "Aguardando confirmação…" : archiveAction === "archive" ? "Confirmar arquivamento auditado" : "Confirmar restauração para pendente"}
        </button>
      </form>
    </section>
  );
}
