import {
  Activity, Cable, Camera, CheckCircle2, ClipboardCheck, CloudUpload, Cpu,
  HardDrive, LockKeyhole, Monitor, ShieldAlert, ShieldCheck, Video, Wifi, Wrench, Printer, FileClock, Router, Signal, FileCheck, Smartphone, AlertTriangle, Network, ScrollText, Settings,
  Snowflake, Thermometer, Wind, Fan, Laptop, HardDriveUpload,
  type LucideIcon,
} from "lucide-react";

type VisualConfig = {
  label: string;
  subtitle: string;
  color: string;
  Icon: LucideIcon;
  symbols: [LucideIcon, LucideIcon, LucideIcon];
  stages: [string, string, string];
};

const COMPUTER: VisualConfig[] = [
  { label: "Identificando sintomas", subtitle: "Observe o contexto antes de concluir a causa",
    color: "from-sky-950 via-sky-800 to-cyan-700", Icon: Activity, symbols: [Monitor, Cpu, Activity],
    stages: ["Início", "Uso diário", "Travamentos"] },
  { label: "Verificações seguras", subtitle: "Comece com observações sem desmontar o equipamento",
    color: "from-blue-950 via-teal-800 to-teal-600", Icon: Wrench, symbols: [Monitor, HardDrive, Wrench],
    stages: ["Reiniciar", "Espaço", "Ventilação"] },
  { label: "Proteção dos arquivos", subtitle: "Confirme uma cópia acessível antes de intervenções",
    color: "from-indigo-950 via-blue-800 to-cyan-700", Icon: CloudUpload, symbols: [HardDrive, CloudUpload, ShieldCheck],
    stages: ["Arquivos", "Cópia", "Conferência"] },
  { label: "Sinais de alerta", subtitle: "Evite testes agressivos se houver suspeita de falha física",
    color: "from-slate-950 via-blue-900 to-orange-700", Icon: ShieldAlert, symbols: [Activity, ShieldAlert, ShieldCheck],
    stages: ["Sintoma", "Interromper", "Avaliar"] },
  { label: "Preparação do chamado", subtitle: "Um relato claro orienta o diagnóstico e o orçamento",
    color: "from-slate-950 via-sky-800 to-blue-700", Icon: ClipboardCheck, symbols: [Monitor, ClipboardCheck, CheckCircle2],
    stages: ["Descrever", "Prioridades", "Orçamento"] },
];
const CCTV: VisualConfig[] = [
  { label: "Ângulos e cobertura", subtitle: "Identifique primeiro as áreas que precisam de visibilidade",
    color: "from-slate-950 via-cyan-900 to-teal-700", Icon: Camera, symbols: [Camera, Video, CheckCircle2],
    stages: ["Objetivo", "Campo de visão", "Revisão"] },
  { label: "Planejamento da infraestrutura", subtitle: "Avalie rede, energia e os pontos de instalação",
    color: "from-blue-950 via-teal-800 to-sky-700", Icon: Cable, symbols: [Camera, Cable, Wifi],
    stages: ["Pontos", "Cabos", "Conexão"] },
  { label: "Gravação e acesso", subtitle: "Combine retenção e permissões antes da entrega",
    color: "from-slate-950 via-indigo-900 to-cyan-700", Icon: HardDrive, symbols: [Camera, HardDrive, LockKeyhole],
    stages: ["Câmeras", "Gravação", "Acesso"] },
  { label: "Privacidade no monitoramento", subtitle: "Respeite espaços pessoais e controle quem vê as imagens",
    color: "from-cyan-950 via-blue-900 to-teal-600", Icon: ShieldCheck, symbols: [Video, ShieldCheck, LockKeyhole],
    stages: ["Enquadrar", "Limitar", "Proteger"] },
  { label: "Escopo de instalação", subtitle: "Descreva equipamentos, rede e suporte para comparar propostas",
    color: "from-slate-950 via-blue-800 to-cyan-700", Icon: ClipboardCheck, symbols: [Camera, Wrench, ClipboardCheck],
    stages: ["Inventário", "Execução", "Entrega"] },
];

const NETWORK: VisualConfig[] = [
  { label: "Identifique a origem da queda", subtitle: "Compare conexão sem fio, cabo e dispositivos", color: "from-sky-950 via-blue-800 to-teal-600", Icon: Network, symbols: [Wifi, Cable, Monitor], stages: ["Wi-Fi", "Cabo", "Comparar"] },
  { label: "Mapa da cobertura", subtitle: "Observe cômodos e obstáculos sem divulgar o endereço", color: "from-blue-950 via-cyan-800 to-emerald-700", Icon: Signal, symbols: [Router, Signal, Smartphone], stages: ["Roteador", "Distância", "Ambiente"] },
  { label: "Verificações conservadoras", subtitle: "Não restaure o roteador sem guardar as configurações", color: "from-indigo-950 via-blue-800 to-teal-700", Icon: Settings, symbols: [Cable, Router, ShieldCheck], stages: ["Cabos", "Estado", "Preservar"] },
  { label: "Sinais de problema físico", subtitle: "Identifique falhas recorrentes e segurança elétrica", color: "from-slate-950 via-blue-900 to-orange-700", Icon: AlertTriangle, symbols: [Activity, ShieldAlert, Wrench], stages: ["Observar", "Interromper", "Avaliar"] },
  { label: "Informações para o chamado", subtitle: "Relate sintomas e região antes de solicitar orçamento", color: "from-sky-950 via-teal-800 to-cyan-700", Icon: ClipboardCheck, symbols: [Wifi, ScrollText, CheckCircle2], stages: ["Sintomas", "Região", "Pedido"] },
];
const PRINTERS: VisualConfig[] = [
  { label: "O que o visor informa", subtitle: "Diferencie conexão, papel e alertas do equipamento", color: "from-blue-950 via-sky-800 to-cyan-700", Icon: Printer, symbols: [Printer, ScrollText, AlertTriangle], stages: ["Visor", "Avisos", "Registrar"] },
  { label: "Verifique a conexão", subtitle: "Compare USB, rede local e outros computadores", color: "from-indigo-950 via-blue-800 to-teal-700", Icon: Network, symbols: [Cable, Wifi, Monitor], stages: ["Cabo", "Rede", "Teste"] },
  { label: "Fila com documentos", subtitle: "Evite reimpressão de material confidencial", color: "from-slate-950 via-cyan-800 to-blue-700", Icon: FileClock, symbols: [FileClock, LockKeyhole, FileCheck], stages: ["Pendente", "Revisar", "Confirmar"] },
  { label: "Papel e suprimentos", subtitle: "Não force mecanismos ou use produtos incompatíveis", color: "from-blue-950 via-teal-800 to-emerald-700", Icon: Printer, symbols: [ScrollText, Printer, Wrench], stages: ["Papel", "Tinta", "Avaliar"] },
  { label: "Pedido com informações úteis", subtitle: "Modelo, mensagem e localidade ajudam na triagem", color: "from-indigo-950 via-blue-800 to-sky-700", Icon: ClipboardCheck, symbols: [Printer, ScrollText, CheckCircle2], stages: ["Modelo", "Sintoma", "Suporte"] },
];

const BACKUP: VisualConfig[] = [
  { label: "Quais arquivos são essenciais?", subtitle: "Priorize documentos, projetos e arquivos de trabalho", color: "from-sky-950 via-blue-800 to-teal-600", Icon: Laptop, symbols: [Laptop, HardDrive, ClipboardCheck], stages: ["Localizar", "Organizar", "Priorizar"] },
  { label: "Cópia independente", subtitle: "Sincronização não é sempre um backup recuperável", color: "from-indigo-950 via-blue-900 to-cyan-700", Icon: CloudUpload, symbols: [HardDrive, CloudUpload, ShieldCheck], stages: ["Origem", "Destino", "Versões"] },
  { label: "Copiar e verificar", subtitle: "Testar alguns arquivos copiados evita falsa segurança", color: "from-slate-950 via-sky-800 to-teal-700", Icon: HardDriveUpload, symbols: [HardDrive, HardDriveUpload, CheckCircle2], stages: ["Copiar", "Abrir", "Conferir"] },
  { label: "Proteja as credenciais", subtitle: "Restrinja o acesso e preserve a privacidade dos dados", color: "from-blue-950 via-indigo-900 to-cyan-700", Icon: LockKeyhole, symbols: [LockKeyhole, ShieldCheck, ClipboardCheck], stages: ["Acesso", "Escopo", "Revisão"] },
  { label: "Pedido com prioridade aos dados", subtitle: "Explique os riscos antes de autorizar a intervenção", color: "from-slate-950 via-blue-800 to-teal-700", Icon: ClipboardCheck, symbols: [Laptop, ClipboardCheck, ShieldCheck], stages: ["Sintomas", "Backup", "Orçamento"] },
];
const CLIMATE: VisualConfig[] = [
  { label: "Modo e condições", subtitle: "Observe o modo e o ambiente, sem presumir a causa", color: "from-cyan-950 via-sky-800 to-teal-600", Icon: Thermometer, symbols: [Snowflake, Thermometer, CheckCircle2], stages: ["Modo", "Ambiente", "Aguardar"] },
  { label: "Circulação de ar", subtitle: "Não abra painéis técnicos para realizar verificações", color: "from-slate-950 via-cyan-800 to-blue-700", Icon: Wind, symbols: [Fan, Wind, ShieldCheck], stages: ["Filtro", "Obstáculo", "Fluxo"] },
  { label: "Sinais para interromper o uso", subtitle: "Evite riscos elétricos e intervenções no refrigerante", color: "from-blue-950 via-slate-800 to-orange-700", Icon: AlertTriangle, symbols: [Thermometer, AlertTriangle, ShieldCheck], stages: ["Sintoma", "Desligar", "Avaliar"] },
  { label: "Histórico do equipamento", subtitle: "Modelo, manutenção e sintomas orientam a triagem", color: "from-sky-950 via-blue-800 to-teal-700", Icon: ClipboardCheck, symbols: [Fan, Settings, ClipboardCheck], stages: ["Modelo", "Histórico", "Relato"] },
  { label: "Atendimento qualificado", subtitle: "O orçamento deve esclarecer diagnóstico e escopo", color: "from-indigo-950 via-blue-800 to-cyan-700", Icon: Wrench, symbols: [ClipboardCheck, Wrench, CheckCircle2], stages: ["Solicitar", "Avaliar", "Combinar"] },
];

const SECTION_VISUALS: Record<string, VisualConfig[]> = {
  computadores: COMPUTER,
  cftv: CCTV,
  redes: NETWORK,
  impressoras: PRINTERS,
  software: BACKUP,
  climatizacao: CLIMATE,
};

export function GuideSectionVisual({ categorySlug, index }: { categorySlug: string; index: number }) {
  const config = (SECTION_VISUALS[categorySlug] ?? COMPUTER)[index];
  if (!config) return null;
  const { Icon, symbols, stages } = config;
  return (
    <figure className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
      <div className={"relative isolate overflow-hidden bg-gradient-to-br " + config.color + " p-5 sm:p-7"}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3 text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/25 bg-white/15">
            <Icon className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Infográfico ilustrativo</p>
            <h3 className="text-lg font-extrabold text-white">{config.label}</h3>
          </div>
        </div>
        <svg viewBox="0 0 660 105" className="relative mt-3 w-full" role="img"
          aria-label={config.stages.join(" → ")}>
          <path d="M122 52H535" stroke="#a0f7eb" strokeWidth="4" strokeDasharray="9 8" opacity=".6" />
          {[88, 330, 572].map((x, i) => (
            <g key={x}>
              <rect x={x-67} y="7" width="134" height="88" rx="20" fill="#ffffff" fillOpacity=".12" stroke="#e6fffc" strokeOpacity=".58" strokeWidth="2" />
              <circle cx={x} cy="48" r="24" fill="#08263b" fillOpacity=".75" stroke="#9bf9e9" strokeWidth="3" />
              <text x={x} y="55" textAnchor="middle" fill="#e9fff9" fontFamily="sans-serif" fontSize="21" fontWeight="700">{i+1}</text>
            </g>
          ))}
        </svg>
        <div className="relative grid grid-cols-3 gap-2">
          {stages.map((stage, i) => {
            const StageIcon = symbols[i] ?? Wrench;
            return (
              <div key={stage} className="flex min-w-0 flex-col items-center gap-1 text-center text-white">
                <StageIcon className="h-5 w-5 text-teal-100" aria-hidden />
                <span className="text-xs font-semibold leading-4 sm:text-sm">{stage}</span>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="border-t border-border bg-muted/30 px-5 py-3 text-xs leading-5 text-muted-foreground">
        {config.subtitle}. Esquema didático, não diagnóstico ou projeto técnico.
      </figcaption>
    </figure>
  );
}
