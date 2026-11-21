import { containsObviousContact } from "./private-message-validation";
import { placeKey } from "./location-labels";

export type ClientRequestStep = 1 | 2 | 3 | 4;

export type ClientRequestDraft = {
  title: string;
  description: string;
  category: string;
  city: string;
  region: string;
};

/** Changing municipality invalidates an earlier technician selection.
 * Formatting-only edits do not change the city.
 */
export function clientRequestCityChanged(previous: string, next: string): boolean {
  return placeKey(previous) !== placeKey(next);
}

export function clientRequestStepError(
  step: ClientRequestStep,
  form: ClientRequestDraft,
  activeCategories: readonly string[],
  catalogUnavailable: boolean,
  share: boolean,
  selectedTechnicianId: string | null,
): string | null {
  if (step === 1 || step === 4) {
    if (form.title.trim().length < 5 || form.title.trim().length > 120) {
      return "Resuma seu problema em pelo menos 5 caracteres.";
    }
    if (form.description.trim().length < 10 || form.description.trim().length > 2000) {
      return "Descreva o problema em pelo menos 10 caracteres, sem dados de contato.";
    }
    if (catalogUnavailable || !activeCategories.includes(form.category)) {
      return "Selecione uma categoria disponível para este atendimento.";
    }
  }
  if (step === 2 || step === 4) {
    if (!form.city.trim() || form.city.trim().length > 80) {
      return "Informe a cidade onde precisa do serviço.";
    }
    if (form.region.trim().length > 120) {
      return "Informe um bairro ou região de até 120 caracteres.";
    }
  }
  if (step === 3 || step === 4) {
    if (share && !selectedTechnicianId) {
      return "Escolha um técnico antes de autorizar o compartilhamento.";
    }
    if (share && containsObviousContact(
      [form.title, form.description, form.city, form.region].join(" "),
    )) {
      return "Retire telefone, e-mail, links e endereço completo antes de compartilhar.";
    }
  }
  return null;
}
