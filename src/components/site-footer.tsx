import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-marinho.png";
import { BookOpen, CircleHelp, FileText, LogIn, MapPin, MessageCircle, Network, Search, UsersRound, Wrench } from "lucide-react";

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
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <img src={logo} alt="Encontre um Técnico" width={324} height={60} className="h-9 w-auto" />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Cadastro livre e gratuito para técnicos. Clientes encontram profissionais por região e serviço,
            com contratação e negociação direta entre as partes.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            O portal não verifica habilitação ou qualidade técnica dos cadastrados.
            O acesso privado a contatos pode ter valor de conveniência informado antes do pagamento.
          </p>
        </div>
        <nav aria-label="Navegação do portal">
          <p className="text-sm font-semibold text-foreground">Portal</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/tecnicos" className="inline-flex items-center gap-2 hover:text-foreground"><Search className="h-4 w-4 text-primary" aria-hidden="true" /> Encontrar técnico</Link></li>
            <li><Link to="/servicos" className="inline-flex items-center gap-2 hover:text-foreground"><Wrench className="h-4 w-4 text-primary" aria-hidden="true" /> Serviços</Link></li>
            <li><Link to="/cobertura" className="inline-flex items-center gap-2 hover:text-foreground"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Cobertura por localidade</Link></li>
            <li><Link to="/guias" className="inline-flex items-center gap-2 hover:text-foreground"><BookOpen className="h-4 w-4 text-primary" aria-hidden="true" /> Guias técnicos</Link></li>
            <li><Link to="/ecossistema" className="inline-flex items-center gap-2 hover:text-foreground"><Network className="h-4 w-4 text-primary" aria-hidden="true" /> Ecossistema de serviços</Link></li>
            <li><Link to="/como-funciona" className="inline-flex items-center gap-2 hover:text-foreground"><CircleHelp className="h-4 w-4 text-primary" aria-hidden="true" /> Como funciona</Link></li>
            <li><Link to="/entrar" className="inline-flex items-center gap-2 hover:text-foreground"><LogIn className="h-4 w-4 text-primary" aria-hidden="true" /> Cadastrar / entrar</Link></li>
          </ul>
        </nav>
        <nav aria-label="Links de ajuda">
          <p className="text-sm font-semibold text-foreground">Ajuda</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/faq" className="inline-flex items-center gap-2 hover:text-foreground"><CircleHelp className="h-4 w-4 text-primary" aria-hidden="true" /> Perguntas frequentes</Link></li>
            <li><Link to="/contato" className="inline-flex items-center gap-2 hover:text-foreground"><MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Contato e privacidade</Link></li>
            <li><Link to="/area-tecnico" className="inline-flex items-center gap-2 hover:text-foreground"><Wrench className="h-4 w-4 text-primary" aria-hidden="true" /> Área do técnico</Link></li>
            <li><Link to="/area-cliente" className="inline-flex items-center gap-2 hover:text-foreground"><UsersRound className="h-4 w-4 text-primary" aria-hidden="true" /> Área do cliente</Link></li>
          </ul>
        </nav>
        <nav aria-label="Documentos legais">
          <p className="text-sm font-semibold text-foreground">Legal e transparência</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex items-center gap-2 hover:text-foreground"><FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> {item.label}</a>
              </li>
            ))}
            <li>
              <button type="button" onClick={openCookiePreferences}
                className="text-left underline-offset-4 hover:text-foreground hover:underline">
                Preferências de cookies
              </button>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © 2026 Encontre um Técnico · Diretório de cadastro livre · Contratação direta ·
        Sem cobrança ao prestador
      </div>
    </footer>
  );
}
