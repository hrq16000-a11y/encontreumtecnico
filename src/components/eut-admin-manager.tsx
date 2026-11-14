import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { catalogWriteError, validateCatalogDraft, type CatalogDraft } from "@/lib/admin-catalog-validation";
import { BRAZIL_STATES, serviceSlug, validMunicipality } from "@/lib/service-taxonomy";

const db = supabase as unknown as SupabaseClient;
const SOURCE = "wordpress_20261108";
const PER_PAGE = 15;

type Category = {slug:string;label:string;description:string;active:boolean;display_order:number};
type Service = {slug:string;category_slug:string;label:string;description:string;active:boolean;display_order:number};
type Historical = {
  source_key:string;wp_post_id:number;title:string;demo_candidate:boolean;wp_sector_tags:string[];
};
type Managed = {
  source_key:string;wp_post_id:number;corrected_name:string|null;
  public_description:string;coverage_notes:string;
  state_uf:string|null;municipality:string|null;neighborhood:string|null;
  location_status:"pendente"|"em_revisao"|"confirmado";
  service_status:"pendente"|"em_revisao"|"confirmado";
  record_state:"pendente"|"em_revisao"|"pronto_para_validacao"|"excluido";
  verification_basis:string;admin_notes:string;
};
type SpecialtyEvidence = { taxonomy: "sector"|"skill"; term_name:string; review_state:"pendente" };
type Assignment = {
  service_slug:string;confirmation_status:"pendente"|"confirmado";evidence:string;
};
const STATES = ["pendente","em_revisao","confirmado"] as const;

export function EutAdminManager() {
  const [categories,setCategories] = useState<Category[]>([]);
  const [services,setServices] = useState<Service[]>([]);
  const [profiles,setProfiles] = useState<Historical[]>([]);
  const [managed,setManaged] = useState<Record<number,Managed>>({});
  const [page,setPage] = useState(0);
  const [total,setTotal] = useState(0);
  const [selected,setSelected] = useState<Historical|null>(null);
  const [form,setForm] = useState<Managed|null>(null);
  const [assignments,setAssignments] = useState<Assignment[]>([]);
  const [specialtyEvidence,setSpecialtyEvidence] = useState<SpecialtyEvidence[]>([]);
  const [catName,setCatName] = useState("");
  const [catDescription,setCatDescription] = useState("");
  const [catOrder,setCatOrder] = useState("0");
  const [serviceName,setServiceName] = useState("");
  const [serviceDescription,setServiceDescription] = useState("");
  const [serviceOrder,setServiceOrder] = useState("0");
  const [parent,setParent] = useState("");
  const [catalogDraft,setCatalogDraft] = useState<CatalogDraft|null>(null);
  const [serviceToAdd,setServiceToAdd] = useState("");
  const [serviceEvidence,setServiceEvidence] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [catalogSearch,setCatalogSearch] = useState("");

  useEffect(() => {
    const deepLinkedSearch = new URLSearchParams(window.location.search).get("busca");
    if (deepLinkedSearch) setCatalogSearch(deepLinkedSearch.slice(0, 80));
  }, []);

  async function loadCatalog() {
    const [ca,sv] = await Promise.all([
      db.from("eut_service_categories").select("slug,label,description,active,display_order").order("display_order"),
      db.from("eut_service_types").select("slug,category_slug,label,description,active,display_order").order("display_order"),
    ]);
    if (ca.error || sv.error) setMessage("Não foi possível carregar categorias e serviços.");
    else {
      setCategories((ca.data ?? []) as Category[]);
      setServices((sv.data ?? []) as Service[]);
    }
  }

  async function loadProfiles(nextPage = page) {
    const { data, count, error } = await db.from("legacy_review_profiles")
      .select("source_key,wp_post_id,title,demo_candidate,wp_sector_tags", {count:"exact"})
      .eq("source_key",SOURCE).eq("kind","candidate")
      .order("wp_post_id")
      .range(nextPage*PER_PAGE,(nextPage+1)*PER_PAGE-1);
    if (error) { setMessage("Não foi possível carregar o inventário de técnicos."); return; }
    const list=(data ?? []) as Historical[];
    setProfiles(list);
    setTotal(count ?? 0);
    const ids=list.map(x=>x.wp_post_id);
    if (!ids.length) { setManaged({}); return; }
    const mg=await db.from("eut_legacy_profile_management")
      .select("*").eq("source_key",SOURCE).in("wp_post_id",ids);
    if (mg.error) { setMessage("Sem acesso às fichas de classificação."); return; }
    const map:Record<number,Managed>={};
    ((mg.data??[]) as Managed[]).forEach(item=>{map[item.wp_post_id]=item;});
    setManaged(map);
  }

  useEffect(()=>{void loadCatalog();},[]);
  useEffect(()=>{void loadProfiles(page);},[page]);

  async function openProfile(profile:Historical) {
    const detail=managed[profile.wp_post_id];
    if (!detail) { setMessage("Ficha de classificação ainda indisponível."); return; }
    setSelected(profile);
    setForm({...detail});
    setServiceEvidence("");
    setSpecialtyEvidence([]);
    const { data:originalEvidence,error:evidenceError }=await db.from("eut_legacy_specialty_evidence")
      .select("taxonomy,term_name,review_state")
      .eq("source_key",SOURCE).eq("wp_post_id",profile.wp_post_id)
      .order("taxonomy").order("term_name");
    if (evidenceError) setMessage("Não foi possível consultar os indícios de especialidades do WordPress.");
    else setSpecialtyEvidence((originalEvidence??[]) as SpecialtyEvidence[]);
    const { data, error }=await db.from("eut_legacy_profile_services")
      .select("service_slug,confirmation_status,evidence")
      .eq("source_key",SOURCE).eq("wp_post_id",profile.wp_post_id)
      .order("service_slug");
    if (error) setMessage("Não foi possível consultar serviços deste perfil.");
    setAssignments((data ?? []) as Assignment[]);
  }

  async function runOperation(fn:()=>Promise<{error?:{message:string}|null}>,ok:string) {
    if (busy) return false;
    setBusy(true);setMessage("");
    try {
      const res=await fn();
      if (res.error) { setMessage("Operação não concluída. Confira permissões e dados antes de repetir."); return false; }
      setMessage(ok);
      return true;
    } catch {
      setMessage("Falha de comunicação com o banco.");
      return false;
    } finally { setBusy(false); }
  }

  // A written row must actually be returned: an RLS-blocked or stale update is not success.
  async function catalogOperation(
    slug:string,
    write:()=>Promise<{data:{slug:string}|null;error:{message:string}|null}>,
    success:string,
  ) {
    return runOperation(async()=>{
      const result=await write();
      return {error:catalogWriteError(slug,result)};
    },success);
  }

  async function newCategory(event:FormEvent) {
    event.preventDefault();
    const slug=serviceSlug(catName.trim());
    const validated=validateCatalogDraft({kind:"category",slug,label:catName,description:catDescription,
      displayOrder:catOrder,categorySlug:""},[]);
    if(validated.error||!slug){setMessage(validated.error??"Informe uma categoria válida.");return;}
    if(categories.some(c=>c.slug===slug)){setMessage("Já existe uma categoria com esse identificador.");return;}
    const ok=await catalogOperation(slug,async()=>db.from("eut_service_categories")
      .insert({slug,...validated.changes,active:true}).select("slug").maybeSingle(),
      "Categoria adicionada.");
    if(ok){setCatName("");setCatDescription("");setCatOrder("0");await loadCatalog();}
  }
  async function newService(event:FormEvent) {
    event.preventDefault();
    const slug=serviceSlug(serviceName.trim());
    const validated=validateCatalogDraft({kind:"service",slug,label:serviceName,description:serviceDescription,
      displayOrder:serviceOrder,categorySlug:parent},categories.filter(c=>c.active).map(c=>c.slug));
    if(validated.error||!slug){setMessage(validated.error??"Informe um serviço válido.");return;}
    if(services.some(s=>s.slug===slug)){setMessage("Já existe um serviço com esse identificador.");return;}
    const ok=await catalogOperation(slug,async()=>db.from("eut_service_types")
      .insert({slug,...validated.changes,category_slug:parent,active:true}).select("slug").maybeSingle(),
      "Serviço adicionado.");
    if(ok){setServiceName("");setServiceDescription("");setServiceOrder("0");await loadCatalog();}
  }
  async function toggleCatalog(which:"category"|"service",slug:string,active:boolean) {
    const dependent=which==="category"?services.filter(s=>s.category_slug===slug&&s.active).length:0;
    if(active&&dependent){
      setMessage(`Oculte antes os ${dependent} serviço(s) ativos desta categoria para manter a descoberta consistente.`);
      return;
    }
    if(which==="service"&&!active){
      const service=services.find(s=>s.slug===slug);
      if(!service||!categories.some(c=>c.slug===service.category_slug&&c.active)){
        setMessage("Reative primeiro a categoria responsável por este serviço.");return;
      }
    }
    if(active){
      if(!window.confirm(`Ocultar este ${which==="category"?"grupo":"serviço"}? O histórico será preservado.`))return;
    }
    const table=which==="category"?"eut_service_categories":"eut_service_types";
    if(await catalogOperation(slug,async()=>db.from(table).update({active:!active})
      .eq("slug",slug).eq("active",active).select("slug").maybeSingle(),
      active?"Item ocultado sem apagar histórico.":"Item reativado.")) await loadCatalog();
  }
  function editCatalog(which:"category"|"service",item:Category|Service) {
    setMessage("");
    setCatalogDraft({kind:which,slug:item.slug,label:item.label,description:item.description,
      displayOrder:String(item.display_order),categorySlug:which==="service"?(item as Service).category_slug:""});
  }
  async function saveCatalogEdit(event:FormEvent) {
    event.preventDefault();
    if(!catalogDraft)return;
    const validated=validateCatalogDraft(catalogDraft,categories.filter(c=>c.active).map(c=>c.slug));
    if(!validated.changes){setMessage(validated.error);return;}
    const changes=validated.changes;
    const original=catalogDraft.kind==="category"?
      categories.find(c=>c.slug===catalogDraft.slug):services.find(s=>s.slug===catalogDraft.slug);
    if(!original){setMessage("Registro não encontrado. Recarregue o catálogo.");return;}
    const table=catalogDraft.kind==="category"?"eut_service_categories":"eut_service_types";
    const slug=catalogDraft.slug;
    const ok=await catalogOperation(slug,async()=>{
      let query=db.from(table).update(changes).eq("slug",slug)
        .eq("label",original.label).eq("description",original.description)
        .eq("display_order",original.display_order).eq("active",original.active);
      if(catalogDraft.kind==="service")query=query.eq("category_slug",(original as Service).category_slug);
      return query.select("slug").maybeSingle();
    },"Alterações do catálogo salvas.");
    if(ok){setCatalogDraft(null);await loadCatalog();}
  }
  async function saveProfile(event:FormEvent) {
    event.preventDefault();
    if(!form||!selected||selected.demo_candidate)return;
    if(form.location_status==="confirmado" &&
      (!validMunicipality(form.state_uf,form.municipality)||form.verification_basis.trim().length<12)) {
      setMessage("Confirme UF, município real e a fonte da verificação antes de validar a localidade.");return;
    }
    const update = {
      corrected_name:form.corrected_name?.trim()||null,
      public_description:form.public_description.slice(0,1500),
      coverage_notes:form.coverage_notes.slice(0,400),
      state_uf:form.state_uf||null,
      municipality:form.municipality?.trim()||null,
      neighborhood:form.neighborhood?.trim()||null,
      location_status:form.location_status,
      service_status:form.service_status,
      record_state:form.record_state,
      verification_basis:form.verification_basis.slice(0,500),
      admin_notes:form.admin_notes.slice(0,800),
    };
    const ok=await runOperation(async()=>db.from("eut_legacy_profile_management")
      .update(update).eq("source_key",SOURCE).eq("wp_post_id",selected.wp_post_id),
      "Ficha atualizada. Cadastro ainda não é público nem aprovado.");
    if(ok)await loadProfiles();
  }
  async function addService() {
    if(!selected||selected.demo_candidate||!serviceToAdd)return;
    const ok=await runOperation(async()=>db.from("eut_legacy_profile_services").insert({
      source_key:SOURCE,wp_post_id:selected.wp_post_id,service_slug:serviceToAdd,
      confirmation_status:"pendente",evidence:"",
    }),"Serviço adicionado para conferência.");
    if(ok){setServiceToAdd("");await openProfile(selected);}
  }
  async function confirmService(item:Assignment) {
    const basis=serviceEvidence.trim().slice(0,500);
    if(basis.length<12) {setMessage("Descreva a fonte da comprovação em pelo menos 12 caracteres.");return;}
    if(!selected)return;
    const ok=await runOperation(async()=>db.from("eut_legacy_profile_services")
      .update({confirmation_status:"confirmado",evidence:basis})
      .eq("source_key",SOURCE).eq("wp_post_id",selected.wp_post_id)
      .eq("service_slug",item.service_slug),"Serviço confirmado.");
    if(ok)await openProfile(selected);
  }
  async function removeService(item:Assignment) {
    if(!selected||!window.confirm("Remover esta vinculação de serviço?"))return;
    const ok=await runOperation(async()=>db.from("eut_legacy_profile_services")
      .delete().eq("source_key",SOURCE).eq("wp_post_id",selected.wp_post_id)
      .eq("service_slug",item.service_slug),"Associação removida.");
    if(ok)await openProfile(selected);
  }

  const common="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
  const btn="min-h-10 rounded-md border border-input px-3 text-sm text-foreground disabled:opacity-50";
  const activeServices=services.filter(s=>s.active && categories.some(c=>c.slug===s.category_slug&&c.active));
  const matchesCatalog = (label: string, slug: string) =>
    `${label} ${slug}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
      .includes(catalogSearch.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"));
  const selectedService=assignments.map(a=>a.service_slug);
  return (
    <section className="mt-10 rounded-xl border border-border bg-card p-5" aria-label="Gestão de categorias e regiões">
      <h2 className="text-xl font-semibold text-card-foreground">Categorias, serviços e localidades</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Gestão manual da migração WordPress. A antiga categoria genérica TI não comprova serviço algum.
        Municípios e bairros só são gravados mediante confirmação. Perfis históricos continuam sem contratação.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Catálogo: criar, consultar, editar e ocultar/reativar. O identificador permanece estável e a exclusão é lógica
        para preservar vínculos, histórico e páginas existentes. Oculte os serviços ativos antes de ocultar uma categoria.
      </p>
      <label className="mt-4 grid gap-1 text-sm font-semibold text-foreground">Localizar categoria ou serviço
        <input className={common} value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}
          maxLength={80} placeholder="Buscar pelo nome ou identificador" />
      </label>
      {message&&<p className="mt-4 rounded-md bg-muted p-3 text-sm text-foreground" role="status">{message}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-4" aria-label="Categorias administráveis">
          <h3 className="font-semibold">Categorias ({categories.length})</h3>
          <form className="mt-3 grid gap-2" onSubmit={newCategory}>
            <input className={common} value={catName} maxLength={100} required
              placeholder="Nova categoria" aria-label="Nova categoria" onChange={e=>setCatName(e.target.value)}/>
            <input className={common} value={catDescription} maxLength={500}
              placeholder="Descrição (opcional)" aria-label="Descrição da categoria" onChange={e=>setCatDescription(e.target.value)}/>
            <label className="grid gap-1 text-xs text-muted-foreground">Posição de exibição
              <input className={common} type="number" min={0} max={9999} step={1} value={catOrder}
                onChange={e=>setCatOrder(e.target.value)} required/>
            </label>
            <button disabled={busy} className={btn} type="submit">Criar categoria</button>
          </form>
          <ul className="mt-4 max-h-72 space-y-2 overflow-auto">
            {categories.filter(c=>matchesCatalog(c.label,c.slug)).map(c=><li key={c.slug} className="flex items-center justify-between gap-2 border-b border-border py-2">
              <span className="min-w-0 text-sm">{c.label} <span className="text-xs text-muted-foreground">({c.slug} · ordem {c.display_order} · {c.active?"ativa":"oculta"})</span></span>
              <span className="flex shrink-0 gap-1">
                <button className={btn} disabled={busy} type="button" onClick={()=>editCatalog("category",c)}>Editar</button>
                <button className={btn} disabled={busy} type="button" onClick={()=>void toggleCatalog("category",c.slug,c.active)}>{c.active?"Ocultar":"Ativar"}</button>
              </span>
            </li>)}
          </ul>
        </section>
        <section className="rounded-lg border border-border p-4" aria-label="Serviços administráveis">
          <h3 className="font-semibold">Serviços ({services.length})</h3>
          <form className="mt-3 grid gap-2" onSubmit={newService}>
            <select className={common} aria-label="Categoria do novo serviço" value={parent} onChange={e=>setParent(e.target.value)} required>
              <option value="">Escolha a categoria</option>
              {categories.filter(c=>c.active).map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
            <input className={common} value={serviceName} maxLength={120}
              placeholder="Ex.: Reparo de placa-mãe" aria-label="Nome do novo serviço"
              onChange={e=>setServiceName(e.target.value)} required/>
            <input className={common} value={serviceDescription} maxLength={500}
              placeholder="Descrição (opcional)" aria-label="Descrição do novo serviço"
              onChange={e=>setServiceDescription(e.target.value)}/>
            <label className="grid gap-1 text-xs text-muted-foreground">Posição de exibição
              <input className={common} type="number" min={0} max={9999} step={1} value={serviceOrder}
                onChange={e=>setServiceOrder(e.target.value)} required/>
            </label>
            <button disabled={busy} className={btn} type="submit">Criar serviço</button>
          </form>
          <ul className="mt-4 max-h-72 space-y-2 overflow-auto">
            {services.filter(s=>matchesCatalog(s.label,s.slug)).map(s=><li key={s.slug} className="flex items-center justify-between gap-2 border-b border-border py-2">
              <span className="min-w-0 text-sm">{s.label}<span className="block text-xs text-muted-foreground">{categories.find(c=>c.slug===s.category_slug)?.label??s.category_slug} · ordem {s.display_order} · {s.active?"ativo":"oculto"}</span></span>
              <span className="flex shrink-0 gap-1">
                <button type="button" disabled={busy} className={btn} onClick={()=>editCatalog("service",s)}>Editar</button>
                <button type="button" disabled={busy} className={btn} onClick={()=>void toggleCatalog("service",s.slug,s.active)}>{s.active?"Ocultar":"Ativar"}</button>
              </span>
            </li>)}
          </ul>
        </section>
      </div>
      {catalogDraft&&(
        <section className="mt-6 rounded-lg border border-primary/30 bg-muted/20 p-4" aria-label="Editor do catálogo">
          <h3 className="font-semibold">Editar {catalogDraft.kind==="category"?"categoria":"serviço"}: {catalogDraft.slug}</h3>
          <p className="mt-1 text-xs text-muted-foreground">O identificador não muda. Alterações concorrentes são recusadas para evitar sobrescritas.</p>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveCatalogEdit}>
            <label className="grid gap-1 text-sm">Nome
              <input className={common} maxLength={catalogDraft.kind==="category"?100:120} required
                value={catalogDraft.label} onChange={e=>setCatalogDraft(v=>v?{...v,label:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm">Posição de exibição
              <input className={common} type="number" min={0} max={9999} step={1} required
                value={catalogDraft.displayOrder} onChange={e=>setCatalogDraft(v=>v?{...v,displayOrder:e.target.value}:v)}/>
            </label>
            {catalogDraft.kind==="service"&&(
              <label className="grid gap-1 text-sm md:col-span-2">Categoria responsável
                <select className={common} required value={catalogDraft.categorySlug}
                  onChange={e=>setCatalogDraft(v=>v?{...v,categorySlug:e.target.value}:v)}>
                  <option value="">Escolha uma categoria ativa</option>
                  {categories.filter(c=>c.active).map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}
                </select>
              </label>
            )}
            <label className="grid gap-1 text-sm md:col-span-2">Descrição
              <textarea className={common} maxLength={500} rows={3} value={catalogDraft.description}
                onChange={e=>setCatalogDraft(v=>v?{...v,description:e.target.value}:v)}/>
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button type="submit" disabled={busy} className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Salvar alterações</button>
              <button type="button" disabled={busy} className={btn} onClick={()=>setCatalogDraft(null)}>Cancelar edição</button>
            </div>
          </form>
        </section>
      )}
      <section className="mt-7 border-t border-border pt-5" aria-label="Organização dos técnicos importados">
        <h3 className="font-semibold">Fichas WordPress — {total} técnicos</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Dados antigos permanecem preservados. Abrir uma ficha não publica nem valida o técnico.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {profiles.map(p=><li key={p.wp_post_id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
              <p className="text-xs text-muted-foreground">#{p.wp_post_id} · {p.demo_candidate?"Demonstração excluída":managed[p.wp_post_id]?.record_state??"Pendente"}</p>
            </div>
            <button type="button" className={btn} onClick={()=>void openProfile(p)} disabled={p.demo_candidate}>
              Organizar
            </button>
          </li>)}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" className={btn} disabled={page===0||busy} onClick={()=>setPage(v=>v-1)}>Anterior</button>
          <span className="text-xs text-muted-foreground">Página {page+1} de {Math.max(1,Math.ceil(total/PER_PAGE))}</span>
          <button type="button" className={btn} disabled={busy||(page+1)*PER_PAGE>=total} onClick={()=>setPage(v=>v+1)}>Próximo</button>
        </div>
      </section>
      {selected&&form&&!selected.demo_candidate&&(
        <section className="mt-7 rounded-lg border border-primary/30 p-4" aria-label="Editar dados do técnico">
          <h3 className="font-semibold">Organizar: {selected.title} (#{selected.wp_post_id})</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Categorias antigas: {selected.wp_sector_tags?.join(", ")||"não identificadas"}. Não usar “TI” como serviço específico sem comprovação.
          </p>
          <section className="mt-4 rounded-md border border-border bg-muted/30 p-3" aria-label="Indícios originais de especialidades">
            <h4 className="text-sm font-semibold">Indícios específicos recuperados ({specialtyEvidence.length})</h4>
            {specialtyEvidence.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {specialtyEvidence.map(e=><li key={`${e.taxonomy}:${e.term_name}`}
                  className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground">
                  {e.term_name} <span className="text-muted-foreground">({e.taxonomy==="sector"?"setor":"habilidade"})</span>
                </li>)}
              </ul>
            ) : <p className="mt-2 text-xs text-muted-foreground">Nenhum indício específico além das categorias genéricas do WordPress.</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              Os termos acima são pistas da base antiga, não comprovam serviços executados nem disponibilidade. Confirme com o titular antes de liberar serviços.
            </p>
          </section>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveProfile}>
            <label className="grid gap-1 text-sm">Nome de exibição corrigido
              <input className={common} value={form.corrected_name??""}
                maxLength={100} onChange={e=>setForm(v=>v?{...v,corrected_name:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm">UF
              <select className={common} value={form.state_uf??""}
                onChange={e=>setForm(v=>v?{...v,state_uf:e.target.value||null}:v)}>
                <option value="">A confirmar</option>
                {BRAZIL_STATES.map(uf=><option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Município (cidade)
              <input className={common} maxLength={100} value={form.municipality??""}
                onChange={e=>setForm(v=>v?{...v,municipality:e.target.value}:v)}
                placeholder="Não preencher Brasil como cidade"/>
            </label>
            <label className="grid gap-1 text-sm">Bairro (opcional)
              <input className={common} maxLength={100} value={form.neighborhood??""}
                onChange={e=>setForm(v=>v?{...v,neighborhood:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm">Conferência da localização
              <select className={common} value={form.location_status}
                onChange={e=>setForm(v=>v?{...v,location_status:e.target.value as Managed["location_status"]}:v)}>
                {STATES.map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Conferência dos serviços
              <select className={common} value={form.service_status}
                onChange={e=>setForm(v=>v?{...v,service_status:e.target.value as Managed["service_status"]}:v)}>
                {STATES.map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">Fonte da conferência da cidade e UF (obrigatória ao confirmar)
              <textarea className={common} rows={2} maxLength={500} value={form.verification_basis}
                onChange={e=>setForm(v=>v?{...v,verification_basis:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">Serviços e áreas atendidas — observações
              <textarea className={common} rows={2} maxLength={400} value={form.coverage_notes}
                onChange={e=>setForm(v=>v?{...v,coverage_notes:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">Descrição revisada (não publicada nesta etapa)
              <textarea className={common} rows={3} maxLength={1500} value={form.public_description}
                onChange={e=>setForm(v=>v?{...v,public_description:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">Notas administrativas privadas
              <textarea className={common} rows={2} maxLength={800} value={form.admin_notes}
                onChange={e=>setForm(v=>v?{...v,admin_notes:e.target.value}:v)}/>
            </label>
            <label className="grid gap-1 text-sm">Etapa do cadastro
              <select className={common} value={form.record_state}
                onChange={e=>setForm(v=>v?{...v,record_state:e.target.value as Managed["record_state"]}:v)}>
                <option value="pendente">Pendente</option>
                <option value="em_revisao">Em revisão</option>
                <option value="pronto_para_validacao">Pronto para validação final</option>
                <option value="excluido">Excluído</option>
              </select>
            </label>
            <div className="flex items-end">
              <button disabled={busy} className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50" type="submit">
                Salvar ficha revisada
              </button>
            </div>
          </form>
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="font-semibold">Vincular serviços comprovados</h4>
            <p className="mt-1 text-xs text-muted-foreground">Adicionar serviço deixa pendente até você registrar a evidência e confirmar.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select className={common+" flex-1"} aria-label="Serviço específico"
                value={serviceToAdd} onChange={e=>setServiceToAdd(e.target.value)}>
                <option value="">Escolha o serviço</option>
                {activeServices.filter(s=>!selectedService.includes(s.slug)).map(s=>
                  <option key={s.slug} value={s.slug}>{categories.find(c=>c.slug===s.category_slug)?.label}: {s.label}</option>)}
              </select>
              <button type="button" className={btn} disabled={busy||!serviceToAdd} onClick={()=>void addService()}>Adicionar</button>
            </div>
            <label className="mt-3 grid gap-1 text-sm">Comprovação para confirmar serviço
              <input className={common} value={serviceEvidence} maxLength={500}
                onChange={e=>setServiceEvidence(e.target.value)}
                placeholder="Ex.: serviço confirmado pelo titular em revisão"/>
            </label>
            <ul className="mt-3 space-y-2">
              {assignments.map(a=><li key={a.service_slug} className="flex items-center justify-between gap-2 border-b border-border py-2 text-sm">
                <div><strong>{services.find(s=>s.slug===a.service_slug)?.label??a.service_slug}</strong>
                <p className="text-xs text-muted-foreground">{a.confirmation_status==="confirmado"?"Confirmado":"Pendente"}</p></div>
                <span className="flex gap-1">
                  {a.confirmation_status!=="confirmado"&&<button type="button" className={btn} disabled={busy} onClick={()=>void confirmService(a)}>Confirmar</button>}
                  <button type="button" className={btn} disabled={busy} onClick={()=>void removeService(a)}>Retirar</button>
                </span>
              </li>)}
            </ul>
          </div>
          <button type="button" className={btn+" mt-5"} onClick={()=>{setSelected(null);setForm(null);}}>Fechar ficha</button>
        </section>
      )}
      <p className="mt-5 text-xs text-muted-foreground">A confirmação aqui organiza a migração. Não aprova publicamente o técnico, não revela contatos nem cria conta Google.</p>
    </section>
  );
}
