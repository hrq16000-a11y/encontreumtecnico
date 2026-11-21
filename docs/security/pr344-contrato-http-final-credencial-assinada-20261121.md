# PR #344 — contrato HTTP final proposto para credencial assinada (v1)

**Data:** 21/11/2026. **Base inspecionada:** PR #344, HEAD `434a4902c90bd0ddc0830b93d068f7eec89fd3c6`.

**Decisão: documento de contrato, NÃO implementação ou homologação. NO-GO.** Não é migration, não modifica SQL/RLS, handlers, frontend, flags, Auth, infraestrutura, dados ou produção. Não repetir H1–H5 nem executar testes nesta rodada. Manter PR Draft e sem merge/deploy.

## 1. Decisões fechadas para a futura implementação isolada

- **Um único endpoint:** `POST /api/presence/leases`, reutilizando a rota TanStack Start já presente. A operação adicional `issue` emite uma credencial curta; `start`, `beat` e `leave` passam a exigir essa credencial assinada. Nenhum endpoint de emissão adicional.
- **Sem compatibilidade permissiva com `tabToken` legado:** o formato atual `^[0-9a-f]{32}$` não pode permanecer aceito em paralelo. Os testes H1–H5 do contrato anterior continuam como evidência histórica; não são homologação desta v1.
- **Validade absoluta da credencial:** 900 segundos (15 min) a partir da emissão; não renovável no servidor nem por heartbeat. `exp = iat + 900`, horários Unix em segundos definidos pelo servidor. Rejeitar quando `now >= exp` (sem período de graça após o vencimento).
- **TTL do lease:** `expires_at = min(now + 75s, hard_expires_at)`; `beat` de ~25 em 25 s, com limite de atualização transacional ~15 s. `start` repetido enquanto lease ativo é idempotente e não consome outra quota.
- **Tombstone/replay:** revogação prevalece sobre chamadas concorrentes e é retida até pelo menos `max(hard_expires_at + 120s, leave_at + 120s)`; purge só depois disso. Mesmo depois do purge, uma credencial vencida falha **antes do banco**. O prazo de segurança de 120s é uma regra de contrato a provar no ambiente isolado, não uma limpeza já implementada.
- **Flags permanecem OFF:** `VITE_EUT_HTTP_PRESENCE_INGEST`, `VITE_EUT_HTTP_PRESENCE_ADMIN_READ`, `VITE_EUT_PRIVATE_REALTIME_PRESENCE` e flags do servidor de teste. Não ativar mesmo com a documentação concluída.

## 2. Formato exato da credencial

String ASCII, **seis segmentos separados por cinco pontos**, sem padding Base64, com comprimento total **até 128 caracteres**:

`p1.<kid>.<nonce>.<iat>.<exp>.<tag>`

| Segmento | Validação da v1 | Origem |
| --- | --- | --- |
| `p1` | Literal, sem alternativas | Servidor |
| `kid` | 1–16 caracteres ASCII `[A-Za-z0-9_-]`; chave ativa de assinatura | Servidor |
| `nonce` | 22 caracteres Base64url sem `=`, decodificados em **16 bytes aleatórios** (128 bits) gerados por CSPRNG; codificação canônica | Servidor |
| `iat` | Dez dígitos decimais ASCII para Unix seconds na janela temporal de 2026; sem zeros extras; tempo real do servidor | Servidor |
| `exp` | Dez dígitos decimais ASCII; **exatamente** `iat + 900` | Servidor |
| `tag` | 43 caracteres Base64url sem padding representando HMAC-SHA-256 completo (32 bytes); codificação canônica | Servidor |

**MAC exato:** HMAC-SHA-256 com a chave secreta de emissão identificada pelo `kid` sobre bytes ASCII de
`EUT-PRESENCE-LEASE/p1|p1.<kid>.<nonce>.<iat>.<exp>`.
O prefixo de domínio impede o uso cruzado da assinatura em outros recursos. O verificador deve comparar MACs de tamanho correto em tempo constante, recusar segmentos extras, codificações não canônicas, versões/kids desconhecidos, `exp-iat != 900`, `iat > now + 10s` e `now >= exp`. A tolerância de 10s só evita rejeitar `iat` ligeiramente futuro entre instâncias; **nunca amplia `exp`**. Rotação: cada `kid` tem apenas uma chave de verificação, mantida até expirar a última credencial assinada + 120s; indisponibilidade de segredo => `503`, sem fallback.

O navegador trata a string como *capacidade bearer* opaca (não é JWT/Auth nem prova de consentimento humano). Pode decodificar o `hardExpiresAt` de resposta para agendar transição, mas **não** escolher nem alterar `iat`/`exp`. Guardar a credencial apenas na memória da aba durante a época de consentimento: nunca cookie, URL, localStorage compartilhado, analytics ou log. Um roubo da credencial permite agir como aquela aba enquanto ela estiver válida; a assinatura garante integridade e validade, não autentica uma pessoa.

**Hash no armazenamento:** HMAC-SHA-256 com **segredo independente de armazenamento** sobre os bytes ASCII `EUT-PRESENCE-TAB/p1|` concatenados ao `nonce` canônico da credencial verificada; persistir apenas `tab_hash` e datas/estado. Assinatura e digest de armazenamento não reutilizam a mesma chave. Sem guardar token em claro, identidade Auth, IP bruto, URL, localidade, conteúdo de busca ou telefone.

## 3. Contrato de transporte fechado

Todas as chamadas: HTTPS same-origin fora do teste local, método POST, `Content-Type: application/json` (charset UTF-8 opcional), corpo **até 512 bytes UTF-8**, campos **exatamente** os do esquema, sem cookies (`credentials: omit`), sem CORS público; validação estrita de `Origin` e `Sec-Fetch-Site` quando presente. `Cache-Control: no-store, max-age=0`, `CDN-Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Content-Type-Options: nosniff` em todas as respostas. Não registrar corpo, `credential`, cabeçalhos Authorization, nonce ou segredos.

| Operação | Corpo JSON **exato** | Resposta de sucesso |
| --- | --- | --- |
| Emissão | `{"op":"issue","consent":true}` | **201** JSON `{"credential":"<string-assinada>","hardExpiresAt":"<ISO-8601-UTC>"}`; somente essas duas propriedades, sem identidade/contagem |
| Início | `{"op":"start","credential":"<string-assinada>","consent":true}` | **204** sem body |
| Batida | `{"op":"beat","credential":"<string-assinada>","consent":true}` | **204** sem body |
| Revogação | `{"op":"leave","credential":"<string-assinada>"}` | **204** sem body |

Os placeholders na tabela representam strings, não exemplos de credenciais emitidas. O `hardExpiresAt` é a conversão UTC de `exp` assinado, não uma extensão de validade. O servidor só pode emitir se as duas flags de ingestão/leitura estiverem **explicitamente** liberadas depois de autorização; nunca pelo valor das flags vindo do cliente.

**Tabela de status de falha** (resposta sem corpo/sem identificadores; não vazar dados):
- **400:** JSON incorreto ou extra, corpo >512 B, credencial ausente, formato legado, versão/kid inválidos, assinatura não correspondente ou codificação não canônica. Credencial forjada é recusada antes de armazenar.
- **403:** origem ou contexto Fetch não autorizado; ausência de CORS público.
- **405:** método diferente de POST, com `Allow: POST` se handler expuser método.
- **410:** credencial **autêntica** mas expirada, lease revogado/expirado ou tentativa de reativar epoch encerrada; `leave` vencido também responde 410 sem gravar tombstone novo.
- **429:** quota compartilhada de `issue` ou `start` excedida; `beat` cedo demais (<15s) também retorna 429. O cliente não usa 429 para criar loops imediatos.
- **503:** flags desligadas, limitação de abuso indisponível, dependência/segredo não configurado, Auth/storage fora ou erro interno. Nunca simular sucesso/zero.

O `GET /api/admin/presence/count` **não muda**: continua `200 {"activeConsentedTabs":N,"checkedAt":"<ISO-8601-UTC>"}` apenas após Auth + verificação atual de `public.user_roles.role='admin'`; 401 para identidade ausente/inválida, 403 sem admin, 503 para indisponibilidade. A futura consulta deve usar **ambas** `expires_at > now()` e `hard_expires_at > now()`. Nenhum SELECT de linhas exposto ao browser.

## 4. Regras de emissão, persistência, concorrência e renovação

1. **`issue`:** chamada só quando o cliente tiver `presence === true`, rota pública e aba visível; o servidor valida a declaração, a origem e uma **quota compartilhada confiável antes de assinar**. Browser não envia `nonce`, `iat`, `exp` nem papel; não aceitar parâmetros adicionais. O servidor **não consegue provar** consentimento/visibilidade humana apenas com esses cabeçalhos ou o campo `consent`.
2. **`start`:** validar assinatura e tempo; de forma transacional, identificar `tab_hash` e só criar lease se não houver revogação/expiração anterior dessa credencial. Repetições da mesma época ativa retornam 204 sem nova quota. Só uma nova época assinada pode substituir a antiga.
3. **`beat`:** nunca insere, nunca estende o `hard_expires_at`, só renova lease ativo respeitando limite de frequência e `min(now+75s,exp)`.
4. **`leave`:** aceita mesmo após o consentimento ser retirado; grava revogação monotônica antes do eventual `start` atrasado. Se assinatura já expirou, não recria registro; a expiração assinada já proíbe `start/beat`.
5. **Troca de época aos 14 min (proposta v1):** com a aba ainda visível/consentida, solicitar `issue` novo e guardá-lo *temporariamente* sem iniciar. Emitir `leave` antigo; **só após `204` confirmado**, emitir `start` novo. Se `leave` falhar, não iniciar novo lease até a expiração lógica/absoluta antiga ter passado e ser verificável por relógio seguro; preferir omitir momentaneamente a aba a contá-la em duplicidade. Se consentimento cair durante o `issue`, descartar credencial retornada sem `start`; não emitir novas credenciais.
6. **Retries:** repetir `start` assinado da mesma época pode ser idempotente. `issue` é **não idempotente**: um retry em timeout pode produzir credencial diferente e gastar quota; aplicar backoff e limites no cliente, com controle compartilhado no servidor; não assumir deduplicação. Não enviar duas solicitações de `issue` concorrentes para a mesma aba. `429` não é autorização para contornar o limitador.
7. **Cleanup:** `purge_after >= max(hard_expires_at+120s,leave_at+120s)` para a marca de revogação. Somente agendador autorizado pode apagar linhas após `purge_after`; contagem exclui expirados antes do purge. Após purge, o servidor rejeita a credencial pelo `exp` ainda que não exista tombstone. Limpeza de quotas compartilhadas exige agendamento separado, também pendente.

**Nota de desenho:** a troca de época com confirmação de `leave` privilegia **não duplicar contagem**. Essa regra não resolve sessões maliciosas anônimas com múltiplas emissões; mitigação por quota confiável de borda ainda é bloqueante para qualquer GO.

## 5. Compatibilidade e gates dirigidos, NÃO executados

Arquivos que exigiriam alteração **em rodada futura autorizada**: `src/lib/visitor-http-presence.ts` (issue/resposta JSON/credencial), `src/components/consented-visitor-presence.tsx` (ciclo de época, revogação de async), `src/lib/pr344-http-presence-handlers.server.ts` (operação issue/verificador), `src/lib/pr344-http-presence-local.server.ts` e SQL **sintético novo** (hard_expires_at + retenção). A rota `src/routes/api/presence/leases.ts` pode permanecer. `src/components/admin-live-presence.tsx` e formato do GET devem permanecer. `CookieNotice` e Realtime não precisam ser tocados.

Gates **pendentes** derivados de [S1–S7](./pr344-revisao-compatibilidade-credenciais-assinadas-20261120.md), rodar somente se essa mudança vier a ser implementada em isolamento:
- **S1:** resposta 201 estrita e HMAC; credencial alterada, formato legado e `kid` desconhecido rejeitados antes do storage; flags OFF => zero emissão.
- **S2:** `iat/exp` no limite 900s, nenhuma extensão por `beat`; replay após purge e após vencimento => 410 sem escrita.
- **S3:** `leave` antes/depois de `start` concorrente, credencial nova sob novo consentimento, nonce anterior sem ressurreição.
- **S4:** cancelamento de `issue` atrasado, BFCache, mudança de rota e troca de época sem duas abas para uma.
- **S5:** quotas compartilhadas de `issue/start` em duas instâncias, sem identidade de rede controlada pelo browser.
- **S6:** rotação de `kid`, comparação de MAC, ausência de chaves no bundle e logs.
- **S7:** schema sintético com `hard_expires_at/purge_after`, privilégios `anon/auth` negados, limpeza segura de leases/budgets, GET admin-only.

H1–H4 foram aprovados como *etapas* no [run #44830108042](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44830108042) (run geral falhou originalmente em H5); H5 corrigido passou no [run #44830743904](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44830743904). **Nenhum deles prova a credencial assinada** e nenhum foi reexecutado nesta revisão.

## 6. Segurança e decisão

- `public` com RLS + `REVOKE` aos papéis públicos é isolamento **lógico**, não schema fisicamente privado. `service_role` apenas no servidor, com `EXECUTE`/grants mínimos e confirmação do papel admin antes da contagem. Não executar DDL nem presumir acesso ao banco oficial.
- Não confiar em `x-pr344-synthetic-network`, `Origin` ou `Sec-Fetch-Site` como autenticação de bots. A escolha real do mecanismo de rate limit e a limpeza programada **seguem pendentes**.
- Não reiniciar Realtime anônimo, abrir SELECT a visitantes, modificar políticas oficiais ou ativar o mecanismo pela existência deste contrato.
- Implementação, SQL/RLS oficiais, limpeza, rate limit, merge e publicação exigem aprovações independentes. **PR permanece Draft. NO-GO.**

**Este documento estabelece um wire contract proposto e verificável para futura homologação isolada; não descreve comportamento já implementado.**
