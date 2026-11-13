import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-marinho.png";
import { ArrowRight, BookOpen, CircleHelp, Cookie, FileText, Headset, LogIn, MapPin, MessageCircle, Network, Search, UsersRound, Wrench } from "lucide-react";

const legalLinks = [
  { href: "/politicas", label: "Central de políticas" },
  { href: "/termos", label: "Termos e condições" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/cookies", label: "Cookies" },
  { href: "/pagamentos-e-reembolsos", label: "Pagamentos e reembolsos" },
  { href: "/condicoes-do-prestador", label: "Condições do prestador" },
  { href: "/responsabilidades", label: "Responsabilidades" },
  { href: "/seguranca", label: "Segurança" },
  { href: "/direitos-dos-titulares", label: "Direitos de dados" },
] as const;

export function SiteFooter() {
  function openCookiePreferences() {
    window.dispatchEvent(new Event("eut-open-cookie-preferences"));
  }

  return (
    <footer className="relative isolate overflow-hidden border-t border-brand-glow/20 bg-gradient-to-br from-brand-navy via-[#173d61] to-brand-navy text-brand-navy-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-brand-glow/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-sm sm:col-span-2 lg:col-span-2">
          <span className="inline-flex max-w-full rounded-xl bg-white p-2 shadow-sm"><img src={logo} alt="Encontre um Técnico" width={324} height={60} className="h-9 w-auto" /></span>
          <p className="mt-3 max-w-sm text-sm text-white/80">
            Cadastro livre e gratuito para técnicos. Clientes encontram profissionais por região e serviço,
            com contratação e negociação direta entre as partes.
          </p>
          <p className="mt-3 text-xs text-white/75">
            O portal não verifica habilitação ou qualidade técnica dos cadastrados.
            O acesso privado a contatos pode ter valor de conveniência informado antes do pagamento.
          </p>
          <Link to="/contato" className="group mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white px-4 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Headset className="h-4 w-4" aria-hidden="true" /> Central de ajuda
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
          </Link>
        </div>
        <nav aria-label="Navegação do portal">
          <p className="text-sm font-semibold text-white">Portal</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link to="/tecnicos" className="inline-flex items-center gap-2 hover:text-white"><Search className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Encontrar técnico</Link></li>
            <li><Link to="/servicos" className="inline-flex items-center gap-2 hover:text-white"><Wrench className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Serviços</Link></li>
            <li><Link to="/cobertura" className="inline-flex items-center gap-2 hover:text-white"><MapPin className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Cobertura por localidade</Link></li>
            <li><Link to="/guias" className="inline-flex items-center gap-2 hover:text-white"><BookOpen className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Guias técnicos</Link></li>
            <li><Link to="/ecossistema" className="inline-flex items-center gap-2 hover:text-white"><Network className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Ecossistema de serviços</Link></li>
            <li><Link to="/como-funciona" className="inline-flex items-center gap-2 hover:text-white"><CircleHelp className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Como funciona</Link></li>
            <li><Link to="/entrar" className="inline-flex items-center gap-2 hover:text-white"><LogIn className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Cadastrar / entrar</Link></li>
          </ul>
        </nav>
        <nav aria-label="Links de ajuda">
          <p className="text-sm font-semibold text-white">Ajuda</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link to="/faq" className="inline-flex items-center gap-2 hover:text-white"><CircleHelp className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Perguntas frequentes</Link></li>
            <li><Link to="/contato" className="inline-flex items-center gap-2 hover:text-white"><MessageCircle className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Contato e privacidade</Link></li>
            <li><Link to="/area-tecnico" className="inline-flex items-center gap-2 hover:text-white"><Wrench className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Área do técnico</Link></li>
            <li><Link to="/area-cliente" className="inline-flex items-center gap-2 hover:text-white"><UsersRound className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Área do cliente</Link></li>
          </ul>
        </nav>
        <nav aria-label="Documentos legais">
          <p className="text-sm font-semibold text-white">Legal e transparência</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex items-center gap-2 hover:text-white"><FileText className="h-3.5 w-3.5 shrink-0 text-white/75" aria-hidden="true" /> {item.label}</a>
              </li>
            ))}
            <li>
              <button type="button" onClick={openCookiePreferences}
                className="inline-flex min-h-11 items-center gap-2 text-left underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <Cookie className="h-4 w-4 text-brand-glow" aria-hidden="true" /> Preferências de cookies
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div className="relative border-t border-white/15 px-4 py-5 text-center text-xs text-white/75">
        © 2026 Encontre um Técnico · Diretório de cadastro livre · Contratação direta ·
        Sem cobrança ao prestador
      </div>
    </footer>
  );
}
