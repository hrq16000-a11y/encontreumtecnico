# EUT #261 — R1: evidência de aceite legal para o assistente (CONTRATO OFFLINE)

Data: 2026-11-13. Base: `af240a7eb1f9ea3e91566caa8513d22870b8fce0`.
**Status: DESIGN/TEST FIXTURE ONLY; nenhum esquema, RPC ou endpoint instalado.**

## Fontes examinadas no GitHub (sem Supabase hospedado)
- `src/lib/assistant-access-contract.ts`: decisão pura fail-closed já está na branch; requer `TrustedAssistantSession` e `StoredAssistantLegalAcceptance`, **NÃO verifica tokens ou armazena aceites**.
- `src/integrations/supabase/auth-middleware.ts`: `requireSupabaseAuth` verifica JWT via `supabase.auth.getClaims(token)`; não comprova por si só revogação operacional/sessão em tempo real nem registro de aceite. Antes de integrar, confirmar fluxo de `getUser` e bloqueio de conta no backend, com chamadas reais autorizadas.
- `src/routes/entrar.tsx`: `termsAccepted` é checkbox/estado do cliente; não prova aceite versionado persistente.
- `src/lib/legal-documents.ts`: `LEGAL_UPDATED_AT = '11 de novembro de 2026'`; versões propostas já fixadas no contrato TS: `eut-termos-2026-11-11` e `eut-privacidade-2026-11-11`. Um update da redação deve disparar revisão/bump explícito dos IDs, não apenas da data.
- `src/components/member-invite-acceptance.tsx`: passa `termsAccepted` para controle de UI e chama RPC de **convite**, não é ledger de termos.
- `src/components/cookie-notice.tsx`: preferência opcional em localStorage, distinta de aceite de Termos e ciência de Privacidade.
- `public.service_requests.accepted_at` (migration `20261109010602...` e tipos gerados): horário de **aceitação do trabalho pelo técnico**, não de documento jurídico.
- Seis migrations versionadas em `supabase/migrations` e metadados de 66 registros históricos (60 sem fonte integral no Git em 12/11). **A ausência de tabela no código examinado não prova ausência no banco hospedado.** Não executar nova migration sem reconciliação.

## Contrato mínimo de persistência sugerido (não cria tabelas)
Reaproveitar uma tabela/RPC legítima de evidência legal, **somente se for confirmada por schema e RLS**, ou planejar armazenamento privado separado, sem misturá-lo a `service_requests`, auditoria de contatos, cookies ou campanhas.

Registro lógico imutável:
```ts
type LegalAcknowledgement = {
  eventId: string;               // UUID gerado no servidor
  userId: string;                // auth uid verificado no servidor
  termsVersion: string;          // exatamente a versão aceita
  privacyNoticeVersion: string;  // ciência da política exibida; não é consentimento geral
  acceptedAt: string;            // timestamptz do servidor, não Date.now do navegador
  channel: "assistant";          // finalidade definida
};
```
- Gravar somente após gesto explícito da conta autenticada com links legíveis às versões corretas. Preservar evidência, histórico de revisões e política de retenção apropriada; **não registrar segredos, texto de perguntas, GPS, fingerprint ou documento pessoal no aceite legal**.
- Servidor recebe intenção e nonce/idempotency key, obtém identidade e `roles` autenticados por fontes confiáveis, resolve versões em configuração versionada, usa tempo do banco/servidor e armazena evento de forma transacional. Nunca aceitar `userId`, papéis, versão arbitrária ou `acceptedAt` fornecidos pelo cliente.
- Autorização: `anon` **não insere, altera ou lê** evidência; `authenticated` só aceita para `auth.uid()` por endpoint com verificação servidor/RLS; outros usuários não leem provas alheias; acesso administrativo auditado e minimizado; atualização/exclusão sem autorização explícita vedadas. A existência de uma coluna não autoriza expor dados pelo PostgREST.
- Consulta operacional: encontrar evidência atual de **mesmo user ID** com `termsVersion` e `privacyNoticeVersion` esperadas; se não encontrada, se a leitura falhar ou se a conta estiver bloqueada/revogada, negar e **não chamar IA**.
- Operação idempotente por `userId` + versões + `channel` (ou chave imutável do evento). Repetição por timeout não cria aceites divergentes. Retornar identificador/prova ao próprio usuário sem transformar `eventId` em permissão de terceiros.
- Caso a política mude, rever a necessidade de reaceite e atualizar **a versão fixa** e seus testes; registrar a versão antiga sem sobreescrita. Revogar opt-ins opcionais é fluxo independente da aceitação dos Termos.
- Somente depois de comprovada a leitura segura, conectar à server function da IA: autenticar `getUser(token)`/sessão e condição operacional, consultar aceite por ID, executar `decideAssistantAccess`, persistir pedido e evento auditável com idempotência, então interpretar. Não confiar em `useAuth()` para autorizar servidor.

## Matriz offline e gates (fixture sintética, não E2E)
| Caso | Resposta esperada | Controle |
|---|---|---|
| Sem sessão válida | negar `authentication_required` | nenhum evento confiável enviado pelo browser |
| Sessão revogada/expirada/conta bloqueada | negar | verificação backend antes do contrato puro |
| Sem aceite armazenado; apenas checkbox | negar `acceptance_required` | não chamar IA |
| Aceite de outro `userId` | negar | isolamento de conta |
| Termos/privacidade em versões antigas | negar | reaceite versionado |
| `acceptedAt` futuro/inválido | negar | horário exclusivamente servidor |
| Erro/timeout na consulta de evidência | negar; operação não confirmada | sem fallback de autorização |
| Evidência correta + papel legítimo | permitir contrato; **ainda não chamar IA** | teste de fluxo posterior |
| Repetição por timeout | um registro lógico por chave idempotente | teste transacional futuro |
| Anônimo lendo tabela ou extrato de terceiros | negar | RLS/grants em staging isolado |

**Gates ainda não realizados:** teste Vitest real do HEAD, TypeScript do app completo, Auth/RLS real e homologação no navegador. A branch não abriu PR; não há workflow de pull_request a executar. O workflow existente `eut-auth-preflight.yml` aceita `workflow_dispatch`, mas o conector GitHub desta sessão disponibiliza consulta de runs e não o despacho autorizado. Não criar PR/workflow extra nem anunciar CI verde.

**Próxima micro-rodada separada:** quando houver runner econômico ou ambiente local com deps do repo, rodar **somente** `src/lib/assistant-access-contract.test.ts` e `tsc --noEmit` (a geração TanStack de rotas deve estar consistente). Após testes, confirmar em ambiente autorizado se existe um ledger de aceite no banco antes de decidir SQL/RLS. Nenhum cadastro, chamada IA, pagamento ou contato é liberado por este documento.
