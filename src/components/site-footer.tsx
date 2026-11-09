import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-foreground">
            Encontre um <span className="text-primary">Técnico</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            A melhor maneira de encontrar e contratar profissionais de tecnologia no Brasil.
          </p>
        </div>
        <nav aria-label="Links do portal">
          <p className="text-sm font-semibold text-foreground">Portal</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link to="/tecnicos" className="hover:text-foreground">Técnicos</Link></li>
            <li><Link to="/servicos" className="hover:text-foreground">Serviços</Link></li>
            <li><Link to="/como-funciona" className="hover:text-foreground">Como funciona</Link></li>
          </ul>
        </nav>
        <nav aria-label="Links de conta">
          <p className="text-sm font-semibold text-foreground">Conta</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link to="/entrar" className="hover:text-foreground">Entrar</Link></li>
            <li><Link to="/area-tecnico" className="hover:text-foreground">Área do técnico</Link></li>
            <li><Link to="/area-cliente" className="hover:text-foreground">Área do cliente</Link></li>
          </ul>
        </nav>
        <nav aria-label="Links de ajuda">
          <p className="text-sm font-semibold text-foreground">Ajuda</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link to="/faq" className="hover:text-foreground">Perguntas frequentes</Link></li>
            <li><Link to="/contato" className="hover:text-foreground">Contato</Link></li>
            <li><Link to="/termos" className="hover:text-foreground">Termos de uso</Link></li>
            <li><Link to="/privacidade" className="hover:text-foreground">Privacidade</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Versão de desenvolvimento — layout provisório.
      </div>
    </footer>
  );
}
