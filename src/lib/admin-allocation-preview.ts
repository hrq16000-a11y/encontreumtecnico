/**
 * Read-only decision support for a marketplace of autonomous technicians.
 * No route distance, technician shift, consent, travel time or SLA is inferred.
 * This module never dispatches, charges, stores or exposes private contacts.
 */
import { BRAZIL_STATES } from "./service-taxonomy";

export type AllocationPriority = "critica" | "alta" | "normal";
export type AllocationRequest = {
  id: string;
  technician_id: string | null;
  status: string;
  category: string;
  city: string;
  region: string | null;
  created_at: string;
};
export type AllocationTechnician = {
  id: string;
  display_name: string;
  status: string;
  city: string;
  state_uf: string | null;
  region: string | null;
  specialties: string[];
  service_slugs: string[];
};
export type AllocationPreference = {
  priority: AllocationPriority;
  requestUf?: string;
  deadline?: string;
  plannedStart?: string;
};
export type AllocationRow = {
  requestId: string;
  category: string;
  city: string;
  priority: AllocationPriority;
  technicianId: string | null;
  technicianName: string | null;
  startLabel: string;
  reason: string;
  risks: string[];
};
export type AllocationResult = {
  rows: AllocationRow[];
  included: number;
  excluded: number;
};

const priorityWeight: Record<AllocationPriority, number> = { critica: 3, alta: 2, normal: 1 };
function normalized(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/[\s_-]+/g, "-").toLocaleLowerCase("pt-BR");
}
function dateValue(input: string | undefined): number | null {
  if (!input) return null;
  const time = Date.parse(input);
  return Number.isFinite(time) ? time : null;
}
function priorityFor(item: AllocationPreference | undefined): AllocationPriority {
  return item?.priority === "critica" || item?.priority === "alta" ? item.priority : "normal";
}
function startLabel(value: string | undefined): string {
  if (!value || dateValue(value) === null || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return "A confirmar";
  return value.slice(8, 10) + "/" + value.slice(5, 7) + " " + value.slice(11, 16) + " (proposto, não confirmado)";
}
export function buildAllocationPreview(
  requests: readonly AllocationRequest[],
  technicians: readonly AllocationTechnician[],
  confirmedForPlanning: ReadonlySet<string>,
  preferences: Readonly<Record<string, AllocationPreference>>,
  now: number,
  limit = 30,
): AllocationResult {
  const open = requests.filter((request) => request.status === "aberta");
  const selected = open.slice(0, Math.max(0, Math.min(limit, 100)));
  const ordered = selected.map((request, index) => ({ request, index }))
    .sort((a, b) => {
      const aPref = preferences[a.request.id], bPref = preferences[b.request.id];
      const level = priorityWeight[priorityFor(bPref)] - priorityWeight[priorityFor(aPref)];
      if (level) return level;
      const deadlineA = dateValue(aPref?.deadline), deadlineB = dateValue(bPref?.deadline);
      if (deadlineA !== null && deadlineB !== null && deadlineA !== deadlineB) return deadlineA - deadlineB;
      if (deadlineA !== null && deadlineB === null) return -1;
      if (deadlineA === null && deadlineB !== null) return 1;
      return a.index - b.index;
    });
  const occupied = new Set<string>();
  const rows: AllocationRow[] = ordered.map(({ request }) => {
    const preference = preferences[request.id];
    const deadline = dateValue(preference?.deadline);
    const plannedStart = dateValue(preference?.plannedStart);
    const requestUf = (preference?.requestUf ?? "").trim().toUpperCase();
    const validRequestUf = (BRAZIL_STATES as readonly string[]).includes(requestUf);
    const risks: string[] = [];
    // Service requests do not currently store state_uf; never infer UF from city name or DDD.
    if (!validRequestUf) risks.push("UF do chamado não confirmada nesta simulação; não comparar cidades homônimas");
    if (preference?.deadline && deadline === null) risks.push("Prazo informado inválido");
    if (deadline === null && !preference?.deadline) risks.push("Prazo/SLA ainda não informado");
    if (deadline !== null && deadline < now) risks.push("Prazo informado já vencido");
    else if (deadline !== null && deadline - now <= 2 * 60 * 60 * 1000) risks.push("Prazo informado vence em até 2 horas");
    if (plannedStart !== null && deadline !== null && plannedStart > deadline)
      risks.push("Início proposto posterior ao prazo informado");
    const matching = technicians.filter((tech) =>
      tech.status === "aprovado" && validRequestUf &&
      normalized(tech.state_uf) === normalized(requestUf) && confirmedForPlanning.has(tech.id) &&
      !occupied.has(tech.id) &&
      (!request.technician_id || tech.id === request.technician_id) &&
      Boolean(normalized(request.category)) &&
      [...tech.specialties, ...tech.service_slugs].some((skill) => normalized(skill) === normalized(request.category)) &&
      Boolean(normalized(request.city)) &&
      normalized(tech.city) === normalized(request.city));
    matching.sort((a, b) => {
      const regionA = Boolean(normalized(request.region)) && normalized(a.region) === normalized(request.region);
      const regionB = Boolean(normalized(request.region)) && normalized(b.region) === normalized(request.region);
      return Number(regionB) - Number(regionA) || a.display_name.localeCompare(b.display_name, "pt-BR");
    });
    const candidate = matching[0];
    if (candidate) {
      occupied.add(candidate.id);
      risks.push("Disponibilidade e cobertura declaradas pelo operador precisam de confirmação do técnico");
      risks.push("Sem cálculo de deslocamento ou garantia de SLA");
      if (!request.technician_id)
        risks.push("Compartilhamento depende de autorização explícita do cliente");
    } else if (request.technician_id) {
      risks.push("Técnico indicado pelo cliente sem disponibilidade ou compatibilidade confirmada; não redistribuir");
    } else if (validRequestUf) {
      risks.push("Sem técnico disponível com UF, cidade e especialidade exatamente compatíveis");
    }
    return {
      requestId: request.id, category: request.category, city: request.city,
      priority: priorityFor(preference),
      technicianId: candidate?.id ?? null,
      technicianName: candidate?.display_name ?? null,
      startLabel: startLabel(preference?.plannedStart),
      reason: candidate ? (normalized(candidate.region) && normalized(candidate.region) === normalized(request.region)
        ? "Especialidade, UF, município e região declarados coincidem"
        : "Especialidade, UF e município declarados coincidem; distância não calculada")
        : "Não é seguro recomendar atribuição com as informações disponíveis",
      risks,
    };
  });
  return { rows, included: selected.length, excluded: Math.max(0, open.length - selected.length) };
}
/** Group-ready message intentionally excludes titles, descriptions, identities and contact details. */
export function safeAllocationMessage(result: AllocationResult): string {
  const items = result.rows.filter((row) => row.technicianId);
  const lines = ["PRÉVIA INTERNA — NÃO É ORDEM DE SERVIÇO CONFIRMADA",
    "Confirmar disponibilidade, autorização do cliente, deslocamento e prazo antes de qualquer contato."];
  if (!items.length) lines.push("Nenhuma sugestão confirmável nesta simulação.");
  for (const row of items) {
    lines.push("Chamado " + row.requestId.slice(0, 8) + " · " + row.technicianName +
      " · início " + row.startLabel + " · confirmação pendente");
  }
  lines.push("Não compartilhar dados de clientes ou telefones no grupo.");
  return lines.join("\n");
}
