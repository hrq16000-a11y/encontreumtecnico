/** Module keys are route allowlists, never authorization claims. */
export const ADMIN_SECTIONS = [
  { key: "inicio", label: "Visão geral", description: "Indicadores atuais e acessos" },
  { key: "tecnicos", label: "Técnicos", description: "Moderação dos perfis cadastrados" },
  { key: "clientes", label: "Clientes", description: "Solicitantes e identificação privada" },
  { key: "solicitacoes", label: "Solicitações", description: "Pedidos recentes" },
  { key: "patrocinadores", label: "Patrocinadores", description: "Campanhas, espaços e criativos" },
  { key: "mensagens", label: "Mensagens", description: "Atendimento e arquivamento" },
  { key: "catalogo", label: "Categorias e serviços", description: "Organização do catálogo" },
  { key: "legado", label: "Acervo WordPress", description: "Histórico importado não publicável" },
  { key: "reivindicacoes", label: "Reivindicações", description: "Titularidade e comprovação" },
  { key: "metricas", label: "Métricas", description: "Buscas com consentimento" },
] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number]["key"];
export type AdminModule = Exclude<AdminSection, "inicio">;
export function validAdminModule(input: string): input is AdminModule {
  return ADMIN_SECTIONS.some((item) => item.key === input && item.key !== "inicio");
}
export function adminModuleTitle(section: AdminSection): string {
  return ADMIN_SECTIONS.find((item) => item.key === section)?.label ?? "Administração";
}
export function adminModulePath(section: AdminSection): string {
  return section === "inicio" ? "/admin" : "/admin/" + section;
}
