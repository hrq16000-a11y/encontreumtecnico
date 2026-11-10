export type FriendlyErrorStatus = 403 | 404 | 500 | 503;

export const FRIENDLY_ERROR_COPY = {
  403: {
    label: "Acesso restrito",
    title: "Esta área precisa de autorização.",
    description: "Não foi possível abrir este conteúdo com o seu acesso atual.",
    suggestion: "Entre com uma conta autorizada ou volte à página inicial.",
    actionLabel: "Entrar na minha conta",
    actionHref: "/entrar",
  },
  404: {
    label: "Página não encontrada",
    title: "Opa! Página não encontrada!",
    description: "Não encontramos o endereço que você procurou. Pode ser que essa página tenha mudado de lugar.",
    suggestion: "Pesquise sua cidade para encontrar um técnico ou continue explorando o portal.",
    actionLabel: "Encontrar um técnico",
    actionHref: "/tecnicos",
  },
  500: {
    label: "Falha temporária",
    title: "Tivemos um imprevisto.",
    description: "Esta página não conseguiu carregar. Estamos trabalhando para que tudo volte ao normal.",
    suggestion: "Você pode tentar novamente ou voltar à página inicial.",
    actionLabel: "Tentar novamente",
    actionHref: null,
  },
  503: {
    label: "Serviço indisponível",
    title: "Voltamos assim que possível.",
    description: "Esta parte do portal está temporariamente indisponível.",
    suggestion: "Tente novamente em instantes ou continue pela página inicial.",
    actionLabel: "Tentar novamente",
    actionHref: null,
  },
} as const satisfies Record<FriendlyErrorStatus, {
  label: string;
  title: string;
  description: string;
  suggestion: string;
  actionLabel: string;
  actionHref: string | null;
}>;
