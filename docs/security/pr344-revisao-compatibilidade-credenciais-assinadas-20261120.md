# PR #344 — revisão de compatibilidade da credencial assinada com HTTP e consumidores

**Escopo: só parecer técnico. Não implementado, não homologado.**  
**Base inspecionada:** PR #344, HEAD `b6aa4e1368676f8c69e0da847a17b855f76e6f9c`.  
**Decisão:** **NO-GO**; PR Draft, flags de presença desligadas. **Sem SQL, testes, merge, deploy ou acesso aos dados oficiais** nesta revisão.

## Evidência aproveitada (não reexecutar)

- Proposta de validade absoluta e grants: [schema/permissões/anti-replay](./pr344-proposta-schema-permissoes-anti-replay-20261120.md).
- H1–H4 **aprovados como etapas específicas** no [workflow #44830108042](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44830108042), embora a execução completa tenha falhado originalmente em H5.
- H5 corrigido e aprovado em novo job [#44830743904](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44830743904). Esses cenários cobrem o **contrato atual de token aleatório**, não a futura assinatura/expiração pós-purge.
- Nenhuma alteração foi feita em `qa/pr344-http-leases-local.sql`, nos handlers, componentes ou consumidores nesta revisão.

## 1. Compatibilidade comprovada pelo código

| Arquivo / superfície | Contrato presente no HEAD | Alteração **mínima futura** | Pode permanecer? |
| --- | --- | --- | --- |
| `src/lib/visitor-http-presence.ts` | `newPresenceTabToken()` cria 32 hex no browser; `sendPresenceLease(op, tabToken)` envia `start/beat/leave` e espera status, sem ler credencial | Acrescentar emissão de credencial autenticada pelo servidor; `start/beat/leave` devem transportar a credencial, nunca reaproveitar token legível antigo. Diferenciar resposta JSON de emissão da resposta 204 de transições | Base `fetch` same-origin, `credentials:omit`, `no-store` e `keepalive` para `leave` |
| `src/lib/pr344-http-presence-handlers.server.ts` | `exactLease` só admite 3 operações e `tabToken` de 32 hex; `applyLease` recebe token bruto; POST retorna 204/429/410/503 | Adicionar operação de emissão com resposta estritamente limitada; validar MAC/assinatura, `kid`, tempo absoluto, tamanho e versão **antes** de storage. Recusar formato legado sem fallback. Separar transições de emissão; manter distinção 400/403/410/429/503 | Verificação de origem, corpo ≤512 B, `no-store`, sem CORS público e `GET` admin separado |
| `src/lib/pr344-http-presence-local.server.ts` | HMAC apenas do token; `pr344_http_synthetic_apply` vê `tab_hash` e instante; não recebe `hard_expires_at` | Futuro adaptador **isolado**, novo contrato para `issued_at`, `hard_expires_at`, `tab_hash` e bloqueio de replay. Chave de assinatura e chave HMAC só no servidor; não abrir conexão oficial neste estágio | Guarda `127.0.0.1` e flags desligadas do atual adaptador permanecem |
| `qa/pr344-http-leases-local.sql` | Lease tem `expires_at` e `purge_after` (120 s para tombstone); falta expiração absoluta. O purge apaga tombstone, permitindo reentrada de token ainda reutilizável | **Em rodada separada e só descartável:** testar invariantes de `hard_expires_at` imutável, `purge_after >= hard_expires_at + margem` e recusa de credencial expirada mesmo sem registro | SQL sintético anterior e gates L/H permanecem como provas do modelo anterior |
| `src/components/consented-visitor-presence.tsx` | Variável local `tabToken`, efeito com `generation`, `start/beat/leave` e heartbeat 25 s; `leave` em ocultação, revogação e pagehide | Obter credencial **somente** se `permitted()`; descartar emissão atrasada após revogação; criar época nova antes do prazo máximo (~15 min **proposto**, não aprovado); enviar `leave` da anterior sem inflar contagem. Revalidar autorização/visibilidade no retorno assíncrono | `canShareAnonymousPresence`, limpeza dos eventos, `keepalive`, exclusão de rotas privadas e geração anti-corrida |
| `src/components/cookie-notice.tsx` / `src/lib/visitor-realtime-presence.ts` | `presence` separado de analytics; evento de consentimento; exclusão de áreas privadas | **Nenhuma mudança obrigatória** para compatibilidade; não transformar aceite de analytics em aceite de presença nem alegar consentimento verificável criptograficamente | Fluxo de consentimento existente |
| `src/components/admin-live-presence.tsx`, `GET /api/admin/presence/count` | GET exige Auth + papel admin persistente (no backend de teste), devolve `activeConsentedTabs,checkedAt` | **Nenhuma mudança de interface**. Futura consulta deve excluir também `hard_expires_at <= now()`, manter 401/403/503 e nenhuma leitura direta | UI de agregado, verificação de papel no servidor, falha ≠ zero |
| `src/routes/api/presence/leases.ts` | Rota POST delega para handlers e adaptador local | Reutilizar mesma rota para emissão e operações, se escolhida essa variante; sem novos endpoints necessários | Guardas no servidor |
| `src/routes/__root.tsx` e flags HTTP | Ingestão aparece só se ambas flags de build forem `enabled`; por padrão OFF | **Nenhuma mudança agora**; não habilitar flags ou reativar Realtime | Estado NO-GO preservado |

### Sequência de protocolo sugerida, **não implementada**

1. `POST /api/presence/leases` com `{op:"issue", consent:true}` somente após consentimento específico, aba visível e rota pública. Sucesso **201**, resposta restrita `{credential,hardExpiresAt}` (nome/JSON indicativos, sujeitos à revisão). O servidor cria nonce aleatório ≥128 bits, `iat`, `exp` absoluto e `kid`; protege tudo com MAC/assinatura verificável apenas pelo servidor. **Não** aceitar valores de prazo escolhidos pelo browser.
2. `POST` para `start/beat/leave`: substituir `tabToken` por `credential`; validar autenticidade, `exp`, versão, política de rotação e chave conhecida **antes** da transição. `start/beat` exigem `consent:true` declarativo; `leave` não precisa consentimento vigente. Operações aceitas continuam **204** sem dados de terceiros.
3. Leases armazenam digest da credencial/nonce, `hard_expires_at` imutável, `expires_at = min(now+75 s,hard_expires_at)`. `leave` escreve tombstone mesmo que `start` esteja em trânsito. Reter tombstone até além de `hard_expires_at + margem`; depois do purge, `exp` criptográfico já impede replay.
4. Para aba com consentimento contínuo, substituir a credencial antes do `exp`, com **nova nonce/época**, sem prorrogar a assinatura antiga. Evitar dois leases contados simultaneamente: encerrar época anterior ao iniciar nova, ou aceitar curto intervalo de ausência (não dupla contagem). Após revogação, nunca solicitar nova credencial.
5. O `issue` deve ter quota **compartilhada** e confiável antes de emitir tokens (retries/concorrência incluídos); `start` da mesma credencial deve ser idempotente e **não cobrar segunda quota**. Cabeçalho `x-pr344-synthetic-network` do teste **não** atende essa exigência em produção.

**Decisão de revisão ainda aberta, não arbitrar silenciosamente:** se a emissão deve ser uma nova operação no POST existente (menor mudança de rota) ou endpoint dedicado; definir formalmente limite de corpo, forma exata de `credential`, códigos de rejeição para assinatura inválida/expirada, tolerância de relógio, TTL absoluto e política de retries em `issue`. Não escolher um formato que force aumento do limite de 512 B sem evidência.

### Advertência de compatibilidade

**A proposta NÃO é drop-in.** Os testes H1–H5 exercem apenas token `^[0-9a-f]{32}$` sem assinatura. Não aceitar simultaneamente token legado como fallback: isso anularia a garantia de anti-replay pós-purge. Uma credencial com assinatura verifica **prazo e origem de emissão**, não pessoa humana, consentimento real ou impossibilidade de fraude por nova emissão.

## 2. Gates **inéditos ou materialmente afetados**, para rodada autorizada futura

| ID | Prova dirigida | Critério objetivo |
| --- | --- | --- |
| **S1** | Emissão condicionada ao consentimento, formato/criptografia | Sem consentimento, rota privada, aba oculta ou flags OFF: zero emissão; resposta 201 não revela PII; ausência de segredo, token forjado, formato antigo, `kid` desconhecido e MAC alterado falham fechados **antes** do storage |
| **S2** | Validade absoluta e purge | Mesmo após purge físico da marca, um `start` com credencial expirara é rejeitado; `beat` jamais prolonga `hard_expires_at`; validar fronteira e margem de relógio; contagem ignora expirados absolutos |
| **S3** | Revogação/ordenação de épocas | `leave` antes/depois de `start` concorrente prevalece; emitir nova credencial após novo consentimento é permitido; credencial velha revogada nunca ressuscita |
| **S4** | Cliente: corrida entre emissão, revogação e navegação | Emissão tardia descartada se consentimento foi revogado ou aba saiu da área pública; BFCache/ocultação impedem batidas e reuso; troca de época antes do prazo não conta duas abas |
| **S5** | Quota compartilhada para `issue` e `start` | Emissão repetida/burst/concor­rente entre duas instâncias não contorna quota; repetição idempotente de `start` não consome nova quota; falha do limitador = 503/429 conforme contrato, nunca emissão ilimitada |
| **S6** | Segredos e rotação de `kid` | Chave ausente, assinatura inválida, chave aposentada e chave de verificação expirada são recusadas; nenhum segredo/token em logs, URL ou browser bundle; versões aceitas somente durante validade apropriada |
| **S7** | Schema e permissões sintéticas **somente se a estrutura mudar** | `anon`/`authenticated` não alcançam tabelas/RPC; admin recebe só agregado; purge não remove tombstones antes da validade máxima; quota e tombstones são removidos depois do prazo autorizado |

**Não repetir integralmente** H1–H5, L1–L10, WebSocket P1–P6 nem testes visuais/CI verdes. Executar somente os cenários S1–S7 implementados ou os casos anteriores **especificamente alterados** pela nova API. Nenhum gate S foi executado nesta revisão, portanto resultado **PENDENTE**, nunca PASS.

## 3. Dependências fora do escopo e decisão

- As credenciais assinadas precisam de armazenamento compartilhado e operação atômica para `issue/start/beat/leave`; o adaptador atual não deixa localhost. Bancos, grants, RLS e scheduler oficiais dependem de autorização distinta.
- Limitação de abuso precisa de identidade de rede originada de borda confiável e não deve registrar IP bruto na tabela de presença. Não basta `Origin` ou `Sec-Fetch-Site`.
- Limpeza física programada (leases **e** buckets), TTL de revogação e observabilidade seguem pendentes; timestamps não apagam linhas.
- Preservar `VITE_EUT_HTTP_PRESENCE_INGEST`, `VITE_EUT_HTTP_PRESENCE_ADMIN_READ`, `VITE_EUT_PRIVATE_REALTIME_PRESENCE` e flags de servidor desligadas. Não integrar nenhum desses componentes automaticamente.

**Conclusão:** compatibilidade arquitetural condicional, **incompatibilidade de contrato HTTP atual** com credenciais assinadas. Próxima micro-rodada potencial: decidir/registrar apenas os formatos de request/response e códigos da emissão assinada; **não** é autorização para implementá-los. **NO-GO mantido.**
