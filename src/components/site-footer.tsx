import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo-marinho.png";

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
            <li><Link to="/tecnicos" className="hover:text-foreground">Encontrar técnico</Link></li>
            <li><Link to="/servicos" className="hover:text-foreground">Serviços</Link></li>
            <li><Link to="/como-funciona" className="hover:text-foreground">Como funciona</Link></li>
            <li><Link to="/entrar" className="hover:text-foreground">Cadastrar / entrar</Link></li>
          </ul>
        </nav>
        <nav aria-label="Links de ajuda">
          <p className="text-sm font-semibold text-foreground">Ajuda</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/faq" className="hover:text-foreground">Perguntas frequentes</Link></li>
            <li><Link to="/contato" className="hover:text-foreground">Contato e privacidade</Link></li>
            <li><Link to="/area-tecnico" className="hover:text-foreground">Área do técnico</Link></li>
            <li><Link to="/area-cliente" className="hover:text-foreground">Área do cliente</Link></li>
          </ul>
        </nav>
        <nav aria-label="Documentos legais">
          <p className="text-sm font-semibold text-foreground">Legal e transparência</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-foreground">{item.label}</a>
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
