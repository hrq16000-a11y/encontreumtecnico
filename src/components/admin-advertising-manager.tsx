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
    typeof item.totals === "object" && item.totals !== null;
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
  if (tab === "sponsors") return text(row.brand_name);
  if (tab === "placements") return text(row.position_label);
  if (tab === "campaigns" || tab === "creatives") return text(row.title);
  return text(all.campaigns.find(c => c.id === row.campaign_id)?.title) +
    " · " + text(all.placements.find(p => p.id === row.placement_id)?.slot_key);
}
function rowStatus(tab: Tab, row: Row): string {
  if (tab === "sponsors" || tab === "campaigns") return text(row.status);
  if (tab === "placements") return text(row.state);
  if (tab === "creatives") return text(row.review_state);
  return row.enabled === true ? "Ativo" : "Desativado";
}
function optionsFor(field: Field, data: Snapshot): Option[] {
  if (field.key === "sponsor_id") return data.sponsors.filter(row => row.status !== "archived")
    .map(row => ({ value: text(row.id), label: text(row.brand_name) }));
  if (field.key === "campaign_id") return data.campaigns.filter(row => row.status === "draft")
    .map(row => ({ value: text(row.id), label: text(row.title) }));
  if (field.key === "placement_id") return data.placements.filter(row => row.state !== "retired")
    .map(row => ({ value: text(row.id), label: text(row.slot_key) + " — " + text(row.position_label) }));
  return field.options ?? [];
}

export function AdminAdvertisingManager() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("sponsors");
  const [draft, setDraft] = useState<Record<string, string>>({ ...defaults.sponsors });
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    void db.rpc("eut_ads_admin_snapshot").then(({ data: result, error: err }) => {
      if (!alive) return;
      if (err || !asSnapshot(result)) setError("Não foi possível consultar publicidade. Confira o acesso administrativo.");
      else setData(result);
      setLoading(false);
    }).catch(() => { if (alive) { setError("Módulo comercial indisponível."); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  async function refresh() {
    const response = await db.rpc("eut_ads_admin_snapshot");
    if (response.error || !asSnapshot(response.data)) throw new Error("Falha ao atualizar os dados.");
    setData(response.data);
  }
  function changeTab(value: Tab) {
    setTab(value); setDraft({ ...defaults[value] }); setImage(null); setError(""); setNotice("");
  }
  function edit(row: Row) {
    const edited: Record<string, string> = { id: text(row.id) };
    for (const f of fields[tab]) {
      if (f.key === "price_brl") edited[f.key] = fromCents(row.price_cents);
      else if (f.key === "budget_brl") edited[f.key] = fromCents(row.budget_limit_cents);
      else if (f.type === "datetime-local") edited[f.key] = toLocal(row[f.key]);
      else edited[f.key] = text(row[f.key]);
    }
    edited.media_storage_key = text(row.media_storage_key);
    setDraft(edited); setImage(null); setError(""); setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !data) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...draft, id: draft.id || null };
      if (tab === "sponsors") {
        const phone = draft.contact_phone_e164?.trim() || "";
        const normalized = phone ? normalizeBrazilianPhone(phone) : null;
        if (phone && !normalized) throw new Error("Telefone: informe DDD + 10 ou 11 dígitos.");
        payload.contact_phone_e164 = normalized;
        payload.tax_id_digits = (draft.tax_id_digits || "").replace(/\D/g, "") || null;
      }
      if (tab === "campaigns") {
        payload.starts_at = toUtc(draft.starts_at || "");
        payload.ends_at = toUtc(draft.ends_at || "");
        payload.price_cents = toCents(draft.price_brl || "");
        payload.budget_limit_cents = toCents(draft.budget_brl || "");
        delete payload.price_brl; delete payload.budget_brl;
      }
      if (tab === "placements") {
        payload.width_px = draft.width_px || null;
        payload.height_px = draft.height_px || null;
      }
      if (tab === "assignments") {
        delete payload.id;
        payload.priority = Number(draft.priority || "100");
      }
      if (tab === "creatives") {
        const isImage = draft.creative_type === "image";
        if (isImage && (draft.image_alt || "").trim().length < 5) {
          throw new Error("Descreva a imagem para acessibilidade antes de enviar.");
        }
        let key = draft.media_storage_key || null;
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
        payload.media_storage_key = isImage ? key : null;
      }
      const kind = tab === "sponsors" ? "sponsor" : tab === "placements" ? "placement" :
        tab === "campaigns" ? "campaign" : tab === "creatives" ? "creative" : "assignment";
      const response = await db.rpc("eut_ads_admin_save", { _kind: kind, _data: payload });
      if (response.error || response.data?.saved !== true) throw new Error("Não foi possível salvar. Confira campos, permissões e vínculos.");
      await refresh();
      setDraft({ ...defaults[tab] }); setImage(null);
      setNotice("Registro salvo com sucesso. Nenhuma publicidade foi publicada no site.");
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
      await refresh(); setNotice("Campanha pausada.");
    } catch { setError("Não foi possível pausar esta campanha."); }
    finally { setBusy(false); }
  }

  const activeRows: Row[] = data ? data[tab] : [];
  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6" aria-label="Gestão de patrocinadores e publicidade">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-card-foreground">Patrocinadores e publicidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestão real e privada de anunciantes, espaços, campanhas, criativos e vinculações.
          </p>
        </div>
        <span className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">Módulo comercial · R3</span>
      </div>
      <p className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
        Nenhum anúncio é exibido publicamente nesta etapa. Campanhas não podem ser aprovadas
        ou ativadas neste painel; imagens ficam em biblioteca privada até a fase de publicação.
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
              <h3 className="font-semibold">{draft.id ? "Editar" : "Novo cadastro"} — {sections.find(s => s.key === tab)?.label}</h3>
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
                      readOnly={tab === "placements" && field.key === "slot_key" && Boolean(draft.id)}
                      disabled={busy} placeholder={field.placeholder}
                      value={draft[field.key] || ""}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}/>
                  )}
                </label>
              ))}
              {tab === "creatives" && draft.creative_type === "image" && (
                <div className="rounded-lg border border-border p-3">
                  <label className="text-sm font-medium">Imagem do banner (JPG, PNG, WebP ou AVIF, até 5 MB)
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
                      className={input} disabled={busy}
                      onChange={(e) => setImage(e.target.files?.[0] ?? null)}/>
                  </label>
                  {(image || draft.media_storage_key) && <p className="mt-2 break-all text-xs text-muted-foreground">
                    {image ? "Arquivo escolhido: " + image.name : "Imagem privada: " + draft.media_storage_key}
                  </p>}
                </div>
              )}
              {tab === "placements" && <p className="text-xs text-muted-foreground">
                Disponível significa apenas que o espaço pode ser comercializado. Não exibe anúncios automaticamente.
              </p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primary} disabled={busy}>{busy ? "Salvando…" : "Salvar no banco"}</button>
                {draft.id && <button type="button" className={btn} disabled={busy}
                  onClick={() => { setDraft({ ...defaults[tab] }); setImage(null); }}>Novo registro</button>}
              </div>
            </form>
            <div>
              <h3 className="font-semibold">Registros existentes</h3>
              {activeRows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum registro neste módulo.</p>}
              <ul className="mt-3 grid gap-2">
                {activeRows.map(row => (
                  <li key={text(row.id)} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold text-card-foreground">{rowLabel(tab, row, data)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rowStatus(tab,row)}
                      {tab === "placements" ? " · " + text(row.slot_key) + " · " + text(row.route_pattern) : ""}
                      {tab === "sponsors" ? " · " + (text(row.contact_email) || "Sem e-mail comercial") : ""}
                      {tab === "creatives" ? " · " + text(row.creative_type) : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(tab !== "campaigns" || row.status === "draft" || row.status === "paused") &&
                       (tab !== "creatives" || row.review_state === "draft") &&
                        <button type="button" className={btn} disabled={busy} onClick={() => edit(row)}>
                          {tab === "assignments" ? "Editar prioridade" : "Editar"}
                        </button>}
                      {tab === "campaigns" && !["paused","expired","archived"].includes(text(row.status)) &&
                        <button type="button" className={btn} disabled={busy}
                          onClick={() => void pauseCampaign(text(row.id))}>Pausar</button>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Até 100 itens por módulo; os totais são reais. Não há campanhas demonstrativas, entrega pública ou receita simulada.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
