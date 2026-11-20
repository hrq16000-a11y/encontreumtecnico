import type { TechnicianPanelTab } from "./technician-panel-navigation";

// These are prompts for optional PUBLIC prose, not claims about the technician.
// Prices, distances, SLA and private documents need typed, permissioned fields.
export const PUBLIC_PROFILE_TOPICS = [
  { id: "experience", label: "Experiência", prefix: "Minha experiência: " },
  { id: "tools", label: "Ferramentas", prefix: "Ferramentas e equipamentos: " },
  { id: "mobility", label: "Deslocamento", prefix: "Como me desloco para atender: " },
  { id: "schedule", label: "Disponibilidade", prefix: "Horários em que costumo atender: " },
] as const;

export type PublicProfileTopicId = typeof PUBLIC_PROFILE_TOPICS[number]["id"];
const BIO_LIMIT = 1000;

export function publicProfileHasTopic(bio: string, topicId: PublicProfileTopicId): boolean {
  const topic = PUBLIC_PROFILE_TOPICS.find((item) => item.id === topicId)!;
  return bio.toLocaleLowerCase("pt-BR").includes(topic.prefix.trim().toLocaleLowerCase("pt-BR"));
}

/** Never invent equipment, experience, transport or availability. */
export function addPublicProfileTopic(bio: string, topicId: PublicProfileTopicId): string {
  const topic = PUBLIC_PROFILE_TOPICS.find((item) => item.id === topicId)!;
  if (publicProfileHasTopic(bio, topicId)) return bio;
  const separator = bio.trim() ? "\n" : "";
  const next = bio.trimEnd() + separator + topic.prefix;
  return next.length <= BIO_LIMIT ? next : bio;
}

export type EnrichmentInput = {
  display_name: string;
  city: string;
  state_uf: string;
  specialties: readonly string[];
  service_slugs: readonly string[];
  bio: string;
  avatar_path: string | null;
  coverage_city_ids: readonly number[];
};

/** Private onboarding guidance only: NOT ranking, certification or eligibility. */
export function technicianProfileEnrichment(input: EnrichmentInput) {
  const meaningfulBio = PUBLIC_PROFILE_TOPICS.reduce<string>((text, topic) =>
    text.replaceAll(topic.prefix, ""), input.bio).trim().length >= 30;
  const entries: Array<{ label: string; complete: boolean; tab: TechnicianPanelTab; help: string }> = [
    { label: "Nome e cidade-base", complete: input.display_name.trim().length >= 2 &&
      Boolean(input.city.trim() && input.state_uf.trim()), tab: "perfil", help: "Confirmar meus dados" },
    { label: "Especialidades e serviços", complete: input.specialties.length > 0 &&
      input.service_slugs.length > 0, tab: "perfil", help: "Informar meus serviços" },
    { label: "Apresentação detalhada", complete: meaningfulBio, tab: "perfil", help: "Contar como trabalho" },
    { label: "Foto profissional autorizada", complete: Boolean(input.avatar_path),
      tab: "foto", help: "Adicionar minha foto" },
    { label: "Municípios de atendimento", complete: input.coverage_city_ids.length > 0,
      tab: "cobertura", help: "Declarar minha cobertura" },
  ];
  return { complete: entries.filter((item) => item.complete).length, total: entries.length, entries };
}
