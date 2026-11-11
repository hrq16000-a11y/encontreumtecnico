import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Headset, MapPin, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRegionalSuggestion } from "@/hooks/use-regional-suggestion";
import { buildAssistanceLead, type AssistanceMode } from "@/lib/assistance-intent";
import { buildSavedLeadWhatsAppUrl, type SavedAssistanceLead } from "@/lib/assistance-whatsapp";
import type { FreeHelpContext } from "@/lib/free-search-help";
import { clearAssistanceDraft, readAssistanceDraft, saveAssistanceDraft, type AssistanceDraft } from "@/lib/assistance-draft";

const input = "mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const services = ["Computadores e notebooks", "Redes e Wi-Fi", "CFTV e segurança", "Impressoras", "Sistemas e software", "Climatização", "Outro serviço"];

export function AssistanceFunnel({ context, onClose }: { context: FreeHelpContext; onClose: () => void }) {
  const navigate = useNavigate();
  const { area: suggested } = useRegionalSuggestion();
  const [restored] = useState(() => readAssistanceDraft(context.technicianId));
  const [mode, setMode] = useState<AssistanceMode | null>(context.mode ?? restored?.mode ?? null);
  const [step, setStep] = useState(context.mode ? 1 : restored?.step ?? 0);
  const [name, setName] = useState(restored?.name ?? "");
  const [email, setEmail] = useState(restored?.email ?? "");
  const [service, setService] = useState(context.service || restored?.service || "");
  const [when, setWhen] = useState(restored?.when ?? "Nos próximos dias");
  const [problem, setProblem] = useState(restored?.problem ?? "");
  const [city, setCity] = useState(context.city || restored?.city || "");
  const [uf, setUf] = useState(context.uf || restored?.uf || "");
  const [neighborhood, setNeighborhood] = useState(context.neighborhood || restored?.neighborhood || "");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savedWhatsAppLead, setSavedWhatsAppLead] = useState<SavedAssistanceLead | null>(null);
  const [error, setError] = useState("");
  const cityEdited = useRef(Boolean(context.city || restored?.city));
  const latestDraft = useRef<AssistanceDraft>({ mode, step, name, email, service, when, problem, city, uf, neighborhood });
  latestDraft.current = { mode, step, name, email, service, when, problem, city, uf, neighborhood };
  function preserve(patch: Partial<AssistanceDraft>) {
    latestDraft.current = { ...latestDraft.current, ...patch };
    saveAssistanceDraft(context.technicianId, latestDraft.current);
  }

  useEffect(() => {
    if (sent) return;
    // Persist after each committed edit: delaying until an idle timer can
    // discard the last characters when a user navigates immediately.
    saveAssistanceDraft(context.technicianId, {
      mode, step, name, email, service, when, problem, city, uf, neighborhood,
    });
  }, [context.technicianId, mode, step, name, email, service, when, problem, city, uf, neighborhood, sent]);

  useEffect(() => {
    if (!suggested || cityEdited.current || city.trim()) return;
    setCity(suggested.city);
    setUf(suggested.uf);
    setNeighborhood(previous => previous || suggested.neighborhood);
  }, [suggested?.city, suggested?.uf, suggested?.neighborhood, city]);

  async function finish() {
    if (!mode || sending) return;
    setError("");
    if (name.trim().length < 2 || !email.includes("@") || !consent) {
      setError("Informe seu nome, e-mail válido e confirme o aviso de contato.");
      return;
    }
    const lead = buildAssistanceLead({
      mode, name, email, service, when, problem, city, uf, neighborhood,
      technicianId: context.technicianId, technicianName: context.technicianName,
      sourceGuide: context.guideSlug,
    });
    if (!lead) { setError("Confira o problema e o tipo de serviço."); return; }
    setSending(true);
    try {
      // Existing admin-only inbox. This does NOT create payment rights.
      const { error: requestError } = await supabase.from("contact_messages").insert(lead);
      if (requestError) throw requestError;
      setSavedWhatsAppLead(lead);
      clearAssistanceDraft(context.technicianId);
      setSent(true);
    } catch {
      setError("Não conseguimos registrar seu pedido. Nada foi cobrado. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  function goToSearch() {
    const citySearch = city.trim().slice(0, 80);
    const ufSearch = uf.trim().toUpperCase().slice(0, 2);
    onClose();
    void navigate({
      to: "/tecnicos",
      search: { especialidade: "Todas", cidade: citySearch, uf: ufSearch,
        bairro: neighborhood.trim().slice(0, 80), regiao: "", servico: "",
        prioridade: citySearch && ufSearch ? "regiao" : "" },
    });
  }

  if (sent) return (
    <div className="p-6 sm:p-8" role="status">
      <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
      <h3 className="mt-3 text-xl font-extrabold text-foreground">Pedido registrado!</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {mode === "managed"
          ? "Sua solicitação foi encaminhada ao canal privado da equipe. Não há pagamento antecipado. O atendimento depende de disponibilidade e eventual serviço será combinado separadamente."
          : "Seu interesse no contato direto foi registrado. Ainda não houve cobrança ou liberação de telefone. A equipe poderá orientar os próximos passos."}
      </p>
      {savedWhatsAppLead && (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <h4 className="font-bold text-foreground">Continue pelo WhatsApp da equipe</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            O pedido já foi registrado no portal. Ao abrir a conversa, você autoriza o compartilhamento
            do nome, e-mail, serviço, urgência, localidade e descrição com o WhatsApp para atendimento.
            Toque em Enviar no WhatsApp para realmente encaminhar a mensagem. A abertura da conversa, sozinha,
            não significa que ela foi enviada ou recebida.
          </p>
          <a href={buildSavedLeadWhatsAppUrl(savedWhatsAppLead)}
            target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white hover:bg-emerald-800">
            Abrir WhatsApp com mensagem pronta →
          </a>
        </div>
      )}
      <button type="button" onClick={mode === "direct" ? goToSearch : onClose}
        className="mt-6 min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground">
        {mode === "direct" ? "Ver técnicos na minha região" : "Concluir"}
      </button>
    </div>
  );

  return (
    <div className="p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Atendimento guiado · Etapa {step + 1} de 3</p>
      <div aria-label="Progresso da solicitação" className="mt-2 flex gap-1.5">
        {[0, 1, 2].map(i => <span key={i} aria-hidden="true" className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-primary" : "bg-muted")} />)}
      </div>

      {step === 0 && (
        <div className="mt-5 space-y-3">
          <h3 className="text-xl font-extrabold text-foreground">Como você prefere encontrar seu técnico?</h3>
          <p className="text-sm text-muted-foreground">Escolha a modalidade. Você poderá revisar tudo antes de enviar.</p>
          <button type="button" onClick={() => { preserve({mode:"direct",step:1}); setMode("direct"); setStep(1); }}
            className="flex min-h-24 w-full items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10">
            <CreditCard className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <span><strong className="block text-base text-foreground">Quero o contato do técnico</strong>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">Solicite orientação para acessar o contato de um profissional. Cobrança e liberação automática estão pausadas; ninguém paga nesta etapa.</span>
            </span>
          </button>
          <button type="button" onClick={() => { preserve({mode:"managed",step:1}); setMode("managed"); setStep(1); }}
            className="flex min-h-24 w-full items-start gap-3 rounded-2xl border border-primary/30 bg-card p-4 text-left transition-colors hover:bg-accent">
            <Headset className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <span><strong className="block text-base text-foreground">Quero ajuda da equipe</strong>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">Gestão assistida, sem custo antecipado. Conte o problema e quando precisa do atendimento; eventual serviço será orçado separadamente.</span>
            </span>
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-5 space-y-4">
          <h3 className="text-xl font-extrabold text-foreground">O que você precisa?</h3>
          {context.technicianName && <p className="rounded-xl bg-primary/10 p-3 text-sm font-semibold text-primary">Profissional selecionado: {context.technicianName}. A equipe receberá sua preferência, sem compartilhar telefones privados.</p>}
          <label className="block text-sm font-semibold text-foreground">Tipo de serviço
            <select className={input} value={services.includes(service) ? service : (service ? "Outro serviço" : "")}
              onChange={e => {preserve({service:e.target.value});setService(e.target.value)}}>
              <option value="">Escolha a categoria</option>
              {services.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-foreground">Para quando?
            <select className={input} value={when} onChange={e => {preserve({when:e.target.value});setWhen(e.target.value)}}>
              {["Hoje / urgente", "Amanhã", "Nos próximos dias", "Sem urgência"].map(value =>
                <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-foreground">Qual problema está acontecendo?
            <textarea className={input} minLength={10} maxLength={1400} rows={3} value={problem}
              onChange={e => {preserve({problem:e.target.value});setProblem(e.target.value)}} placeholder="Ex.: O computador não conecta ao Wi-Fi. Não coloque telefones nem endereços completos." />
          </label>
          <p className="rounded-xl bg-accent/60 p-3 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {city.trim() ? <>Região sugerida: <strong>{city}{uf ? "/" + uf : ""}</strong>. Você poderá corrigir na próxima etapa.</> :
              <>A localização aproximada será usada quando disponível; não é obrigatório informar endereço.</>}
          </p>
          <p className="text-xs text-muted-foreground">Não compartilhe senhas, CPF, número completo de cartão ou dados sensíveis.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => {preserve({step:0});setStep(0)}} className="min-h-12 rounded-xl border border-border px-4 text-sm font-semibold text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" disabled={!service.trim() || problem.trim().length < 10}
              onClick={() => {preserve({step:2});setStep(2)}} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
              Continuar <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 space-y-4">
          <h3 className="text-xl font-extrabold text-foreground">Onde podemos ajudar e como responder?</h3>
          <p className="text-xs leading-5 text-muted-foreground">Cidade e bairro são sugestões editáveis. Se a rede não identificar sua cidade, você pode continuar sem informá-la.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-foreground">Cidade (opcional)
              <input className={input} value={city} maxLength={80} onChange={e => { cityEdited.current = true; preserve({city:e.target.value,uf:""});setCity(e.target.value);setUf(""); }} placeholder="Cidade aproximada" autoComplete="address-level2" />
            </label>
            <label className="block text-sm font-semibold text-foreground">Bairro (opcional)
              <input className={input} value={neighborhood} maxLength={80} onChange={e => {preserve({neighborhood:e.target.value});setNeighborhood(e.target.value)}} placeholder="Só se souber" autoComplete="address-level3" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-foreground">Seu nome
              <input className={input} required minLength={2} maxLength={100} value={name} onChange={e => {preserve({name:e.target.value});setName(e.target.value)}} autoComplete="name" />
            </label>
            <label className="block text-sm font-semibold text-foreground">E-mail para resposta
              <input className={input} required type="email" maxLength={255} value={email} onChange={e => {preserve({email:e.target.value});setEmail(e.target.value)}} autoComplete="email" />
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs leading-5 text-foreground">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-primary" />
            Autorizo o portal a utilizar os dados deste pedido para responder ao meu atendimento, conforme a Política de Privacidade.
          </label>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Nenhum telefone privado de técnico será liberado por este pedido. Nada será cobrado nesta etapa. O rascunho fica somente nesta aba por até 45 minutos e é apagado após o envio confirmado.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => {preserve({step:1});setStep(1)}} className="min-h-12 rounded-xl border border-border px-4 text-sm font-semibold text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" disabled={sending || !consent || name.trim().length < 2 || !email.includes("@")}
              onClick={() => void finish()} className="min-h-12 flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {sending ? "Registrando pedido…" : mode === "managed" ? "Solicitar gestão sem antecipação" : "Registrar interesse e continuar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
