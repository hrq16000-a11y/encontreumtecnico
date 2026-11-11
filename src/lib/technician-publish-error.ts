/** Client-safe publication feedback. Never reveal raw SQL/PostgREST messages or details. */
export type PublishError = { code?: string | null; message?: string | null } | null;

export function technicianPublishErrorMessage(error: PublishError): string {
  const code = error?.code ?? "";
  const recovery = "Seu rascunho permanece nesta aba.";
  if (code === "42501" || code === "PGRST301" || code === "401" || code === "403") {
    return `Não foi possível confirmar sua autorização. Entre novamente na conta e retome o cadastro. ${recovery}`;
  }
  if (code === "PGRST202" || code === "42883") {
    return `O serviço de publicação está temporariamente indisponível. Não altere seus dados: tente novamente mais tarde. ${recovery}`;
  }
  if (code === "P0001") {
    return `O servidor recusou a publicação por uma regra do cadastro. Seus dados foram preservados na aba; não crie outra conta. Solicite suporte para identificar a restrição.`;
  }
  if (code === "23503" || code === "23514" || code === "22P02" || code === "23502") {
    return `O servidor recusou uma informação obrigatória do cadastro. Revise município, categorias e serviços. ${recovery}`;
  }
  if (code === "23505") {
    return `Já existe um registro relacionado a esta conta. Não crie outra conta; solicite ajuda para recuperar seu cadastro. ${recovery}`;
  }
  const reference = /^[A-Z0-9]{4,8}$/.test(code) ? ` Referência: ${code}.` : "";
  return `Não foi possível publicar agora.${reference} ${recovery} Se persistir, informe a referência ao suporte.`;
}
