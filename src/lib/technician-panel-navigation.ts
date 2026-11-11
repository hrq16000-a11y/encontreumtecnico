/** Deep-linkable technician workspaces. Pure UI navigation, never permission checks. */
export const TECHNICIAN_PANEL_TABS = [
  { key: "inicio", label: "Visão geral", description: "Resumo e situação do cadastro" },
  { key: "perfil", label: "Meu perfil", description: "Dados, especialidades e serviços" },
  { key: "cobertura", label: "Regiões atendidas", description: "Municípios oficiais e raio" },
  { key: "foto", label: "Foto do perfil", description: "Avatar público com consentimento" },
  { key: "solicitacoes", label: "Solicitações", description: "Disponibilidade e pedidos recebidos" },
  { key: "indicacoes", label: "Indicações", description: "Convites e benefícios de destaque" },
  { key: "configuracoes", label: "Minha segurança", description: "Telefone privado e confirmação" },
  { key: "recuperacao", label: "Cadastro anterior", description: "Revisar ou recuperar histórico" },
] as const;
export type TechnicianPanelTab = typeof TECHNICIAN_PANEL_TABS[number]["key"];
export const TECHNICIAN_TAB_HASH_PREFIX = "#eut-tecnico-";

export function technicianTabFromHash(hash: string): TechnicianPanelTab {
  const value = hash.startsWith(TECHNICIAN_TAB_HASH_PREFIX)
    ? hash.slice(TECHNICIAN_TAB_HASH_PREFIX.length) : "";
  const found = TECHNICIAN_PANEL_TABS.find((tab) => tab.key === value);
  return found?.key ?? "inicio";
}

export function technicianTabHref(tab: TechnicianPanelTab): string {
  return TECHNICIAN_TAB_HASH_PREFIX + tab;
}
