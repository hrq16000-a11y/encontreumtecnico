type AdminShortcut = {
  anchor: string;
  name: string;
  description: string;
};

const SHORTCUTS: AdminShortcut[] = [
  { anchor: "admin-patrocinadores", name: "Patrocinadores e banners", description: "Gerenciar anunciantes, espaços, campanhas e criativos privados" },
  { anchor: "admin-catalogo", name: "Categorias e serviços", description: "Criar, revisar e organizar especialidades" },
  { anchor: "admin-legado", name: "Acervo WordPress", description: "Conferir registros importados sem publicá-los" },
  { anchor: "admin-reivindicacoes", name: "Reivindicações", description: "Analisar pedidos de titularidade" },
  { anchor: "admin-tecnicos", name: "Técnicos cadastrados", description: "Aprovar, suspender e revisar perfis ativos" },
  { anchor: "admin-solicitacoes", name: "Solicitações", description: "Acompanhar demandas dos clientes" },
  { anchor: "admin-mensagens", name: "Mensagens", description: "Responder e arquivar contatos" },
  { anchor: "admin-metricas", name: "Buscas e indicadores", description: "Consultar estatísticas com consentimento" },
];

/**
 * Acesso direto somente a módulos reais já existentes.
 * A publicidade possui CRUD privado real. Entrega pública e receita
 * continuam bloqueadas até revisão das próximas rodadas.
 */
export function AdminControlHub() {
  return (
    <section className="mt-7 rounded-xl border border-border bg-card p-5" aria-label="Central de gestão">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-card-foreground">Central de gestão</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Acesse cada área de trabalho do portal. Registros do WordPress em revisão
            são diferentes dos técnicos com conta ativa.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          Gestão por módulos
        </span>
      </div>

      <div className="mt-5 rounded-lg border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-card-foreground">Patrocinadores e banners</h3>
          <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">
            Prioridade comercial
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          A gestão privada de patrocinadores, posições e criativos está disponível abaixo.
          Cards patrocinados e banners de imagem podem ser aprovados para três
          espaços públicos, após confirmação comercial. A imagem original continua
          privada e só a cópia aprovada é entregue. Segmentação e relatórios
          ainda dependem das próximas rodadas.
        </p>
        <a href="#admin-patrocinadores" className="mt-3 inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Abrir gestão de patrocínios
        </a>
      </div>

      <nav aria-label="Acessos rápidos da administração" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <a
            key={item.anchor}
            href={`#${item.anchor}`}
            className="group rounded-lg border border-border p-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">
              {item.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
          </a>
        ))}
      </nav>
    </section>
  );
}
