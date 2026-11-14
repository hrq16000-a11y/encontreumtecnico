import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilianPhone } from "@/lib/brazilian-phone";

const db = supabase as unknown as SupabaseClient;
type Tab = "sponsors" | "placements" | "campaigns" | "creatives" | "assignments";
type Row = Record<string, unknown>;
type Snapshot = {
  sponsors: Row[]; placements: Row[]; campaigns: Row[];
  creatives: Row[]; assignments: Row[]; totals: Record<string, number>;
};
type Sort = "recentes" | "antigos" | "nome";
const PAGE_SIZE = 15;
type Option = { value: string; label: string };
type Field = { key: string; label: string; type?: string; required?: boolean;
  max?: number; placeholder?: string; options?: Option[] };
const btn = "min-h-10 rounded-md border border-input px-3 py-2 text-sm text-foreground disabled:opacity-50";
const primary = "min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50";
const input = "mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const options = (values: string[]): Option[] => values.map((value) => ({ value, label: value }));
const sections: { key: Tab; label: string }[] = [
  { key: "sponsors", label: "Patrocinadores" }, { key: "placements", label: "Espaços" },
  { key: "campaigns", label: "Campanhas" }, { key: "creatives", label: "Criativos" },
  { key: "assignments", label: "Vinculações" },
];
const fields: Record<Tab, Field[]> = {
  sponsors: [
    { key: "brand_name", label: "Nome da marca", required: true, max: 120 },
    { key: "legal_name", label: "Razão social", max: 180 },
    { key: "tax_id_digits", label: "CNPJ (14 dígitos, opcional)", max: 18 },
    { key: "contact_email", label: "E-mail comercial privado", type: "email", max: 254 },
    { key: "contact_phone_e164", label: "Telefone com DDD (10 ou 11 dígitos)", type: "tel", max: 40 },
    { key: "website_url", label: "Site do patrocinador (HTTPS)", type: "url", max: 2048, placeholder: "https://..." },
    { key: "status", label: "Situação comercial", type: "select", options: [
      { value: "prospect", label: "Prospecção" }, { value: "negotiating", label: "Negociação" },
      { value: "contracted", label: "Contratado" }, { value: "paused", label: "Pausado" },
      { value: "archived", label: "Arquivado" },
    ] },
    { key: "internal_notes", label: "Observações internas", type: "textarea", max: 3000 },
  ],
  placements: [
    { key: "slot_key", label: "ID estável do espaço", required: true, max: 96, placeholder: "home.hero_below" },
    { key: "route_pattern", label: "Rota pública", required: true, max: 180, placeholder: "/tecnicos" },
    { key: "position_label", label: "Nome da posição", required: true, max: 120 },
    { key: "format", label: "Formato", type: "select", options: [
      { value: "image", label: "Imagem" }, { value: "sponsored_card", label: "Card patrocinado" },
      { value: "video", label: "Vídeo (futuro)" }, { value: "carousel", label: "Carrossel (futuro)" },
    ] },
    { key: "device_scope", label: "Dispositivos", type: "select", options: [
      { value: "all", label: "Todos" }, { value: "desktop", label: "Desktop" }, { value: "mobile", label: "Celular" },
    ] },
    { key: "width_px", label: "Largura (px)", type: "number" },
    { key: "height_px", label: "Altura (px)", type: "number" },
    { key: "state", label: "Estado do inventário", type: "select", options: [
      { value: "draft", label: "Rascunho" }, { value: "available", label: "Disponível para venda" },
      { value: "paused", label: "Pausado" }, { value: "retired", label: "Desativado" },
    ] },
  ],
  campaigns: [
    { key: "sponsor_id", label: "Patrocinador", type: "select", required: true },
    { key: "title", label: "Nome da campanha", required: true, max: 160 },
    { key: "starts_at", label: "Início (opcional no rascunho)", type: "datetime-local" },
    { key: "ends_at", label: "Término (opcional no rascunho)", type: "datetime-local" },
    { key: "pricing_model", label: "Modelo comercial", type: "select", options: options(["fixed", "package", "cpm", "cpc"]) },
    { key: "price_brl", label: "Preço (R$)", placeholder: "250,00" },
    { key: "budget_brl", label: "Limite de orçamento (R$)", placeholder: "1500,00" },
    { key: "status", label: "Situação (sem publicação)", type: "select", options: [
      { value: "draft", label: "Rascunho" }, { value: "paused", label: "Pausada" }, { value: "archived", label: "Arquivada" },
    ] },
  ],
  creatives: [
    { key: "campaign_id", label: "Campanha em rascunho", type: "select", required: true },
    { key: "title", label: "Nome interno do criativo", required: true, max: 160 },
    { key: "creative_type", label: "Tipo", type: "select", options: [
      { value: "sponsored_card", label: "Card patrocinado" }, { value: "image", label: "Banner com imagem" },
    ] },
    { key: "headline", label: "Título do anúncio", max: 150 },
    { key: "description", label: "Texto", max: 400, type: "textarea" },
    { key: "image_alt", label: "Descrição acessível da imagem", max: 240 },
    { key: "destination_url", label: "Link HTTPS de destino", required: true, type: "url", max: 2048 },
  ],
  assignments: [
    { key: "campaign_id", label: "Campanha em rascunho", type: "select", required: true },
    { key: "placement_id", label: "Espaço", type: "select", required: true },
    { key: "priority", label: "Prioridade de inventário (0–1000)", type: "number", required: true },
  ],
};
const defaults: Record<Tab, Record<string, string>> = {
  sponsors: { status: "prospect" },
  placements: { format: "image", device_scope: "all", state: "draft", route_pattern: "/" },
  campaigns: { status: "draft", pricing_model: "fixed" },
  creatives: { creative_type: "sponsored_card" },
  assignments: { priority: "100" },
};
function asSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return sections.every(({ key }) => Array.isArray(item[key])) &&
    typeof item["totals"] === "object" && item["totals"] !== null;
}
function toLocal(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function toUtc(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Data e horário inválidos.");
  return d.toISOString();
}
function toCents(value: string): string | null {
  const price = value.trim().replace(",", ".");
  if (!price) return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(price)) throw new Error("Use valores como 250,00.");
  const parts = price.split(".");
  return String(Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0")));
}
function fromCents(value: unknown): string {
  return typeof value === "number" ? (value / 100).toFixed(2).replace(".", ",") : "";
}
function text(value: unknown): string { return value === null || value === undefined ? "" : String(value); }
function rowLabel(tab: Tab, row: Row, all: Snapshot): string {
  if (tab === "sponsors") return text(row["brand_name"]);
  if (tab === "placements") return text(row["position_label"]);
  if (tab === "campaigns" || tab === "creatives") return text(row["title"]);
  return text(all.campaigns.find(c => c["id"] === row["campaign_id"])?.["title"]) +
    " · " + text(all.placements.find(p => p["id"] === row["placement_id"])?.["slot_key"]);
}
function rowStatus(tab: Tab, row: Row): string {
  if (tab === "sponsors" || tab === "campaigns") return text(row["status"]);
  if (tab === "placements") return text(row["state"]);
  if (tab === "creatives") return text(row["review_state"]);
  return row["enabled"] === true ? "Ativo" : "Desativado";
}
const persistedFields: Record<Tab, string[]> = {
  sponsors: ["brand_name", "status", "legal_name", "contact_email", "contact_phone_e164"],
  placements: ["slot_key", "position_label", "route_pattern", "state", "format"],
  campaigns: ["sponsor_id", "title", "status", "pricing_model", "price_cents"],
  creatives: ["campaign_id", "title", "creative_type", "headline", "destination_url"],
  assignments: ["campaign_id", "placement_id", "priority"],
};
function matchesPersistedFields(tab: Tab, row: Row, payload: Row): boolean {
  return persistedFields[tab].every((key) => text(row[key]).trim() === text(payload[key]).trim());
}
function optionsFor(field: Field, data: Snapshot): Option[] {
  if (field.key === "sponsor_id") return data.sponsors.filter(row => row["status"] !== "archived")
    .map(row => ({ value: text(row["id"]), label: text(row["brand_name"]) }));
  if (field.key === "campaign_id") return data.campaigns.filter(row => row["status"] === "draft")
    .map(row => ({ value: text(row["id"]), label: text(row["title"]) }));
  if (field.key === "placement_id") return data.placements.filter(row => row["state"] !== "retired")
    .map(row => ({ value: text(row["id"]), label: text(row["slot_key"]) + " — " + text(row["position_label"]) }));
  return field.options ?? [];
}

export function AdminAdvertisingManager() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "sponsors";
    const area = new URLSearchParams(window.location.search).get("area");
    return sections.find((section) => section.key === area)?.key ?? "sponsors";
  });
  const [search, setSearch] = useState(() => typeof window === "undefined" ? "" :
    new URLSearchParams(window.location.search).get("busca")?.slice(0, 80) ?? "");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sort, setSort] = useState<Sort>("recentes");
  const [listPage, setListPage] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({ ...defaults.sponsors });
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalCampaignId, setApprovalCampaignId] = useState("");
  const [approvalCreativeId, setApprovalCreativeId] = useState("");
  const [approvalPlacementId, setApprovalPlacementId] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  useEffect(() => {
    let alive = true;
    void Promise.resolve(db.rpc("eut_ads_admin_snapshot")).then(({ data: result, error: err }) => {
      if (!alive) return;
      if (err || !asSnapshot(result)) setError("Não foi possível consultar publicidade. Confira o acesso administrativo.");
      else setData(result);
      setLoading(false);
    }).catch(() => { if (alive) { setError("Módulo comercial indisponível."); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  async function refresh(): Promise<Snapshot> {
    const response = await db.rpc("eut_ads_admin_snapshot");
    if (response.error || !asSnapshot(response.data)) throw new Error("Falha ao atualizar os dados.");
    setData(response.data);
    return response.data;
  }
  function changeTab(value: Tab) {
    setTab(value); setDraft({ ...defaults[value] }); setImage(null); setError(""); setNotice("");
    setSearch(""); setStatusFilter("todos"); setSort("recentes"); setListPage(0);
  }
  function edit(row: Row) {
    const edited: Record<string, string> = { id: text(row["id"]) };
    for (const f of fields[tab]) {
      if (f.key === "price_brl") edited[f.key] = fromCents(row["price_cents"]);
      else if (f.key === "budget_brl") edited[f.key] = fromCents(row["budget_limit_cents"]);
      else if (f.type === "datetime-local") edited[f.key] = toLocal(row[f.key]);
      else edited[f.key] = text(row[f.key]);
    }
    edited["media_storage_key"] = text(row["media_storage_key"]);
    setDraft(edited); setImage(null); setError(""); setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !data) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...draft, id: draft["id"] || null };
      if (tab === "sponsors") {
        const phone = draft["contact_phone_e164"]?.trim() || "";
        const normalized = phone ? normalizeBrazilianPhone(phone) : null;
        if (phone && !normalized) throw new Error("Telefone: informe DDD + 10 ou 11 dígitos.");
        payload["contact_phone_e164"] = normalized;
        payload["tax_id_digits"] = (draft["tax_id_digits"] || "").replace(/\D/g, "") || null;
      }
      if (tab === "campaigns") {
        payload["starts_at"] = toUtc(draft["starts_at"] || "");
        payload["ends_at"] = toUtc(draft["ends_at"] || "");
        payload["price_cents"] = toCents(draft["price_brl"] || "");
        payload["budget_limit_cents"] = toCents(draft["budget_brl"] || "");
        delete payload["price_brl"]; delete payload["budget_brl"];
      }
      if (tab === "placements") {
        payload["width_px"] = draft["width_px"] || null;
        payload["height_px"] = draft["height_px"] || null;
      }
      if (tab === "assignments") {
        delete payload["id"];
        payload["priority"] = Number(draft["priority"] || "100");
      }
      if (tab === "creatives") {
        const isImage = draft["creative_type"] === "image";
        if (isImage && (draft["image_alt"] || "").trim().length < 5) {
          throw new Error("Descreva a imagem para acessibilidade antes de enviar.");
        }
        let key = draft["media_storage_key"] || null;
        if (isImage && image) {
          const extByMime: Record<string, string> = {
            "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
          };
          const ext = extByMime[image.type];
          if (!ext || image.size < 1 || image.size > 5 * 1024 * 1024) {
            throw new Error("Envie uma imagem JPG, PNG, WebP ou AVIF com até 5 MB.");
          }
          const path = "ads/" + crypto.randomUUID() + "." + ext;
          const upload = await supabase.storage.from("eut-ad-assets")
            .upload(path, image, { upsert: false, contentType: image.type });
          if (upload.error) throw new Error("Falha ao enviar o arquivo privado.");
          key = path; setDraft(current => ({ ...current, media_storage_key: path })); setImage(null);
        }
        if (isImage && !key) throw new Error("Selecione a imagem antes de salvar.");
        payload["media_storage_key"] = isImage ? key : null;
      }
      const kind = tab === "sponsors" ? "sponsor" : tab === "placements" ? "placement" :
        tab === "campaigns" ? "campaign" : tab === "creatives" ? "creative" : "assignment";
      const response = await db.rpc("eut_ads_admin_save", { _kind: kind, _data: payload });
      if (response.error || response.data?.saved !== true || !response.data?.id) {
        throw new Error("Não foi possível salvar. Confira campos, permissões e vínculos.");
      }
      const current = await refresh();
      const persisted = current[tab].find((row) => row["id"] === response.data.id);
      if (!persisted || !matchesPersistedFields(tab, persisted, payload)) {
        throw new Error("A gravação retornou sucesso, mas os dados alterados não foram confirmados na consulta atual. Confira antes de repetir.");
      }
      setDraft({ ...defaults[tab] }); setImage(null);
      setNotice("Registro salvo e consultado novamente. Nenhuma publicidade foi publicada no site.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha de gravação.");
    } finally { setBusy(false); }
  }

  async function pauseCampaign(id: string) {
    if (busy || !window.confirm("Pausar esta campanha imediatamente?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await db.rpc("eut_ads_admin_save", { _kind: "pause_campaign", _data: { id } });
      if (response.error || response.data?.saved !== true) throw new Error("Não foi possível pausar esta campanha.");
      const current = await refresh();
      if (current.campaigns.find((row) => row["id"] === id)?.["status"] !== "paused") {
        throw new Error("Não foi possível confirmar a pausa na consulta atual.");
      }
      setNotice("Campanha pausada e estado persistido confirmado.");
    } catch { setError("Não foi possível pausar esta campanha."); }
    finally { setBusy(false); }
  }

  async function approvePublicCard() {
    if (busy || !approvalCampaignId || !approvalCreativeId ||
        !approvalPlacementId || approvalNote.trim().length < 16) return;
    if (!window.confirm("Ativar este anúncio patrocinado no portal público? Confira o contrato, o período e o conteúdo. A publicação será imediata.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await db.rpc("eut_ads_admin_activate_card", {
        _campaign_id: approvalCampaignId,
        _creative_id: approvalCreativeId,
        _placement_id: approvalPlacementId,
        _approval_note: approvalNote.trim(),
      });
      if (response.error || response.data?.activated !== true) {
        throw new Error("Não foi possível ativar. Confira contrato, valor positivo, período vigente, card aprovado e espaço disponível.");
      }
      const current = await refresh();
      if (current.campaigns.find((row) => row["id"] === approvalCampaignId)?.["status"] !== "active" ||
          current.creatives.find((row) => row["id"] === approvalCreativeId)?.["review_state"] !== "approved" ||
          !current.assignments.some((row) => row["campaign_id"] === approvalCampaignId &&
            row["placement_id"] === approvalPlacementId && row["enabled"] === true)) {
        throw new Error("Ativação enviada, mas a confirmação dos três estados não foi obtida. Confira antes de repetir.");
      }
      setApprovalCampaignId(""); setApprovalCreativeId(""); setApprovalPlacementId(""); setApprovalNote("");
      setNotice("Card patrocinado aprovado e ativado no slot autorizado. Use Pausar para interromper a veiculação.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao ativar campanha.");
    } finally { setBusy(false); }
  }

  const eligibleApprovalCreatives = data?.creatives.filter(row =>
    row["campaign_id"] === approvalCampaignId &&
    row["review_state"] === "draft" &&
    row["creative_type"] === "sponsored_card") ?? [];
  const eligibleApprovalAssignments = data?.assignments.filter(row =>
    row["campaign_id"] === approvalCampaignId && row["enabled"] !== true &&
    data.placements.some(p => p["id"] === row["placement_id"] &&
      p["state"] === "available" && p["format"] === "sponsored_card" &&
      p["device_scope"] === "all" &&
      ["home.content_1", "search.top", "services.content_1"].includes(String(p["slot_key"])))) ?? [];

  const activeRows: Row[] = data ? data[tab] : [];
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const statusOptions = [...new Set(activeRows.map((row) => rowStatus(tab, row)))].sort();
  const filteredRows = activeRows.filter((row) => {
    if (statusFilter !== "todos" && rowStatus(tab, row) !== statusFilter) return false;
    if (!search.trim()) return true;
    const searchable = [rowLabel(tab, row, data!), rowStatus(tab, row), row["id"],
      row["slot_key"], row["route_pattern"], row["headline"], row["legal_name"]]
      .map(text).join(" ");
    return normalize(searchable).includes(normalize(search.trim()));
  });
  const orderedRows = [...filteredRows];
  if (sort === "antigos") orderedRows.reverse();
  if (sort === "nome") orderedRows.sort((a, b) =>
    rowLabel(tab, a, data!).localeCompare(rowLabel(tab, b, data!), "pt-BR", { sensitivity: "base" }));
  const maxListPage = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
  const safeListPage = Math.min(listPage, maxListPage - 1);
  const visibleRows = orderedRows.slice(safeListPage * PAGE_SIZE, (safeListPage + 1) * PAGE_SIZE);
  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6" aria-label="Gestão de patrocinadores e publicidade">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-card-foreground">Patrocinadores e publicidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão real e privada de anunciantes, espaços, campanhas, criativos e vinculações.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">Módulo comercial · R4</span>
      </div>
      <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
        Apenas cards patrocinados com contrato, valor comercial, período vigente e
        aprovação administrativa podem ser exibidos em três espaços públicos. Imagens
        permanecem privadas e não são publicadas nesta etapa.
      </p>
      {loading && <p className="mt-4 text-sm text-muted-foreground">Carregando área comercial…</p>}
      {error && <p role="alert" className="mt-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-md border border-border p-3 text-sm text-foreground">{notice}</p>}
      {!loading && <button type="button" className={btn + " mt-4"} disabled={busy}
        onClick={() => { setLoading(true); void refresh().then(() => setNotice("Dados atualizados."))
          .catch(() => setError("Não foi possível atualizar o inventário.")).finally(() => setLoading(false)); }}>
        Atualizar dados
      </button>}
      {data && (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {sections.map(({ key, label }) => (
              <div key={key} className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-bold">{data.totals[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <div role="tablist" aria-label="Módulos da publicidade" className="mt-6 flex flex-wrap gap-2 border-b border-border pb-4">
            {sections.map(({ key, label }) => (
              <button type="button" key={key} role="tab" aria-selected={tab === key}
                className={tab === key ? primary : btn} onClick={() => changeTab(key)}>{label}</button>
            ))}
          </div>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <form onSubmit={(event) => void save(event)} className="grid content-start gap-3">
              <h3 className="font-semibold">{draft["id"] ? "Editar" : "Novo cadastro"} — {sections.find(s => s.key === tab)?.label}</h3>
              {fields[tab].map(field => (
                <label key={field.key} className="text-sm font-medium text-foreground">
                  {field.label}{field.required ? " *" : ""}
                  {field.type === "select" ? (
                    <select className={input} value={draft[field.key] || ""}
                      required={field.required} disabled={busy}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}>
                      {!field.options && <option value="">Selecione</option>}
                      {optionsFor(field, data).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea rows={3} maxLength={field.max} disabled={busy} className={input} value={draft[field.key] || ""}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}/>
                  ) : (
                    <input className={input} type={field.type || "text"}
                      required={field.required} maxLength={field.max}
                      readOnly={tab === "placements" && field.key === "slot_key" && Boolean(draft["id"])}
                      disabled={busy} placeholder={field.placeholder}
                      value={draft[field.key] || ""}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}/>
                  )}
                </label>
              ))}
              {tab === "creatives" && draft["creative_type"] === "image" && (
                <div className="rounded-lg border border-border p-3">
                  <label className="text-sm font-medium">Imagem do banner (JPG, PNG, WebP ou AVIF, até 5 MB)
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
                      className={input} disabled={busy}
                      onChange={(e) => setImage(e.target.files?.[0] ?? null)}/>
                  </label>
                  {(image || draft["media_storage_key"]) && <p className="mt-2 break-all text-xs text-muted-foreground">
                    {image ? "Arquivo escolhido: " + image.name : "Imagem privada: " + draft["media_storage_key"]}
                  </p>}
                </div>
              )}
              {tab === "placements" && <p className="text-xs text-muted-foreground">
                Disponível significa apenas que o espaço pode ser comercializado. Não exibe anúncios automaticamente.
              </p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primary} disabled={busy}>{busy ? "Salvando…" : "Salvar no banco"}</button>
                {draft["id"] && <button type="button" className={btn} disabled={busy}
                  onClick={() => { setDraft({ ...defaults[tab] }); setImage(null); }}>Novo registro</button>}
              </div>
            </form>
            <div>
              <h3 className="font-semibold">Registros existentes</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Filtros de publicidade">
                <label className="text-sm">Localizar registro
                  <input className={input} maxLength={80} value={search}
                    placeholder="Nome, título ou identificador"
                    onChange={(event) => { setSearch(event.target.value); setListPage(0); }} />
                </label>
                <label className="text-sm">Situação
                  <select className={input} value={statusFilter}
                    onChange={(event) => { setStatusFilter(event.target.value); setListPage(0); }}>
                    <option value="todos">Todas as situações</option>
                    {statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-sm sm:col-span-2">Organização
                  <select className={input} value={sort}
                    onChange={(event) => { setSort(event.target.value as Sort); setListPage(0); }}>
                    <option value="recentes">Cadastros recentes primeiro</option>
                    <option value="antigos">Cadastros antigos primeiro</option>
                    <option value="nome">Nome A–Z</option>
                  </select>
                </label>
              </div>
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                {filteredRows.length} resultado(s) entre {activeRows.length} carregado(s) · {data.totals[tab] ?? 0} no banco.
                {Number(data.totals[tab] ?? 0) > activeRows.length && " A pesquisa cobre apenas os 100 registros mais recentes recebidos."}
              </p>
              {activeRows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum registro neste módulo.</p>}
              {activeRows.length > 0 && filteredRows.length === 0 &&
                <p className="mt-3 text-sm text-muted-foreground">Nenhum registro corresponde aos filtros.</p>}
              <ul className="mt-3 grid gap-2">
                {visibleRows.map(row => (
                  <li key={text(row["id"])} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold text-card-foreground">{rowLabel(tab, row, data)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rowStatus(tab,row)}
                      {tab === "placements" ? " · " + text(row["slot_key"]) + " · " + text(row["route_pattern"]) : ""}
                      {tab === "sponsors" ? " · " + (text(row["contact_email"]) || "Sem e-mail comercial") : ""}
                      {tab === "creatives" ? " · " + text(row["creative_type"]) : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(tab !== "campaigns" || row["status"] === "draft" || row["status"] === "paused") &&
                       (tab !== "creatives" || row["review_state"] === "draft") &&
                        <button type="button" className={btn} disabled={busy} onClick={() => edit(row)}>
                          {tab === "assignments" ? "Editar prioridade" : "Editar"}
                        </button>}
                      {tab === "campaigns" && !["paused","expired","archived"].includes(text(row["status"])) &&
                        <button type="button" className={btn} disabled={busy}
                          onClick={() => void pauseCampaign(text(row["id"]))}>Pausar</button>}
                    </div>
                  </li>
                ))}
              </ul>
              {maxListPage > 1 && <nav aria-label="Paginação da publicidade" className="mt-4 flex items-center justify-between gap-2">
                <button type="button" className={btn} disabled={safeListPage === 0}
                  onClick={() => setListPage(value => Math.max(0, value - 1))}>Anterior</button>
                <span className="text-xs text-muted-foreground">Página {safeListPage + 1} de {maxListPage}</span>
                <button type="button" className={btn} disabled={safeListPage + 1 >= maxListPage}
                  onClick={() => setListPage(value => value + 1)}>Próxima</button>
              </nav>}
              {tab === "campaigns" && (
                <section className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="Aprovação de campanhas">
                  <h4 className="font-semibold">Aprovar e ativar card patrocinado</h4>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Disponível somente para patrocinador contratado, campanha em rascunho com
                    preço positivo, início e fim válidos, criativo textual revisado e vínculo
                    com espaço público disponível. Dados do contrato ficam privados.
                    Não ativa imagens ou campanhas segmentadas.
                  </p>
                  <div className="mt-3 grid gap-3">
                    <label className="text-sm">Campanha para revisão
                      <select className={input} value={approvalCampaignId} disabled={busy}
                        onChange={(e) => { setApprovalCampaignId(e.target.value); setApprovalCreativeId(""); setApprovalPlacementId(""); }}>
                        <option value="">Selecione campanha em rascunho</option>
                        {data.campaigns.filter(row => row["status"] === "draft").map(row =>
                          <option key={text(row["id"])} value={text(row["id"])}>{text(row["title"])}</option>
                        )}
                      </select>
                    </label>
                    <label className="text-sm">Criativo textual
                      <select className={input} disabled={busy || !approvalCampaignId}
                        value={approvalCreativeId} onChange={e => setApprovalCreativeId(e.target.value)}>
                        <option value="">Selecione card para aprovação</option>
                        {eligibleApprovalCreatives.map(row =>
                          <option key={text(row["id"])} value={text(row["id"])}>{text(row["title"])} — {text(row["headline"])}</option>
                        )}
                      </select>
                    </label>
                    <label className="text-sm">Posição pública cadastrada
                      <select className={input} disabled={busy || !approvalCampaignId}
                        value={approvalPlacementId} onChange={e => setApprovalPlacementId(e.target.value)}>
                        <option value="">Selecione espaço compatível</option>
                        {eligibleApprovalAssignments.map(row => {
                          const placement = data.placements.find(p => p["id"] === row["placement_id"]);
                          return <option key={text(row["id"])} value={text(row["placement_id"])}>
                            {text(placement?.["slot_key"])} — {text(placement?.["position_label"])}
                          </option>;
                        })}
                      </select>
                    </label>
                    <label className="text-sm">Referência da autorização comercial (privada)
                      <textarea minLength={16} maxLength={500} rows={3} className={input} disabled={busy}
                        placeholder="Ex.: Contrato assinado em...; destino e texto revisados"
                        value={approvalNote} onChange={e => setApprovalNote(e.target.value)}/>
                    </label>
                    <button type="button" className={primary} disabled={
                      busy || !approvalCampaignId || !approvalCreativeId || !approvalPlacementId ||
                      approvalNote.trim().length < 16
                    } onClick={() => void approvePublicCard()}>
                      {busy ? "Validando…" : "Confirmar revisão e ativar card público"}
                    </button>
                  </div>
                </section>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Até 100 itens por módulo. Não há campanhas fictícias nem receita simulada;
                a veiculação exige aprovação e pode ser pausada pelo administrador.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
