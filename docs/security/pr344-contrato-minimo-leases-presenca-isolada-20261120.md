# PR #344 — contrato mínimo de leases para presença consentida (somente homologação isolada)

**Estado:** proposta de contrato, **NO-GO**. Este arquivo não é migration, implementação, autorização para criar infraestrutura, nem aprovação de publicação. Nenhum SQL/RLS/configuração do Supabase oficial deve ser alterado. Não habilitar a presença nem desativar `Allow public access` neste estágio.

**Base real:** o workflow isolado [44679755391](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44679755391) mostrou que `INSERT` anônimo, sem `SELECT`, não permite ingressar no canal privado Presence. O bloqueio de técnico e do canal legado passou; a prova de agregado administrativo e revogação ficou bloqueada. Reutilizar essa evidência; **não repetir os cenários WebSocket**.

## 1. Superfície de contrato

Apenas dois endpoints HTTP *same-origin* do TanStack Start; não há WebSocket no navegador público:

| Endpoint conceitual | Operações / resposta | Quem pode usar |
| --- | --- | --- |
| `POST /api/presence/leases` | `start`, `beat`, `leave` com corpo validado; sucesso sem contagem e sem identidade de terceiros | Visitante anônimo com consentimento declarado e aba pública visível |
| `GET /api/admin/presence/count` | `{ "activeConsentedTabs": 0, "checkedAt": "<ISO-8601>" }` (exemplo de **formato**, não dado real) | Exclusivamente sessão Supabase válida com papel **admin** verificado pelo servidor |

O cliente usa `canShareAnonymousPresence(pathname, consent)`, cujo campo `presence` é separado de `analytics`; áreas administrativas/técnicas/privadas e abas ocultas não enviam sinal. A interface permanece suspensa sem flags de ingestão **e** exibição explicitamente liberadas depois dos gates.

### Corpo público (exemplo de esquema, não endpoint ativo)

- `op`: enum `start | beat | leave`.
- `tabToken`: string hexadecimal de 32 bytes? **Não:** exatamente **32 caracteres hexadecimais (128 bits)**, gerados com `crypto.getRandomValues` por episódio de consentimento da aba. Não usar ID do Auth, cookie de marketing, IP ou localização.
- `consent`: literal `true` apenas para `start`/`beat`; o handler não deve tratar isso como prova de identidade ou de consentimento imune a falsificação.
- Nada mais no JSON. Corpo <=512 bytes. Rejeitar campos extras, valores inesperados, requisições cross-origin e conteúdo excessivo. A mesma chave fica na aba apenas até revogação, encerramento ou erro de expiração; gerar **nova** ao reconsentir.

Respostas previstas: `204` para operação aceita, `400` inválido, `403` origem/fetch recusado, `409/410` token revogado/expirado, `429` excesso, `503` armazenamento indisponível. Nunca retornar estado/contagem de outras abas pelo POST. `Cache-Control: no-store` e `Referrer-Policy: no-referrer` onde aplicável. Cookies de autenticação não autorizam a consulta pública.

## 2. Modelo de armazenamento temporário mínimo

**Uma coleção/tabela dedicada de leases em armazenamento compartilhado** (não memória da função Vercel e não `search_events` ou `realtime.messages`). Modelo conceitual, sem DDL:

| Campo | Tipo lógico | Restrição |
| --- | --- | --- |
| `tab_hash` | digest HMAC-SHA-256 binário/hex | PK/UNIQUE; HMAC do `tabToken` com chave exclusiva do servidor; token original nunca persistido |
| `state` | `active | revoked` | `revoked` é marcador temporário irreversível para a mesma chave |
| `expires_at` | timestamp UTC | ativo no máximo ~75 s sem heartbeat; contador considera apenas `state=active` e `expires_at > now()` |
| `purge_after` | timestamp UTC | ativo expirado/revogado deve ser apagado fisicamente, com retenção curta e definida; tombstone de revogação por pelo menos 120 s |

Não armazenar email, telefone, Auth UUID, IP, user-agent, URL, cidade, localização, busca, conteúdo do pedido, identificação ou histórico de navegação. O CDN/proxy pode tecnicamente receber o IP de transporte; o app não o grava na tabela nem em logs de payload. Nunca imprimir o `tabToken` ou o HMAC secret.

**Acesso:** a menor opção compatível com o `supabaseAdmin` existente é uma tabela futuramente dedicada no Supabase Data API com RLS habilitada desde sua criação, sem `GRANT` para `anon`/`authenticated`, revogação explícita de quaisquer privilégios padrão desses papéis, e acesso necessário somente ao servidor com `service_role`. Nenhuma leitura de linhas pelo painel, mesmo administrador: apenas a contagem via handler. `service_role` bypassa RLS e **nunca** deve chegar ao browser. Se for escolhido schema fisicamente não exposto, exigir conexão Postgres direta ou RPC especificamente protegida; **não** assumir que o cliente Data API atual alcança o schema. Ambas opções exigem avaliação e autorização posteriores; **nenhuma tabela criada agora**.

## 3. Semântica atômica, TTL e revogação

- `start`: inserir estado `active` com expiração ~75 s. Repetição da mesma chave ativa é idempotente; **não** ressuscitar chave marcada `revoked`. Nenhuma contagem incrementada diretamente: contar chaves únicas ativas.
- `beat`: renovar a expiração a cada ~25 s **somente** se a chave já existe, está ativa e não expirou. Nunca fazer `INSERT` por `beat`; solicitação atrasada não pode reabrir lease.
- `leave`: gravar `revoked` de forma monotônica, **inclusive se `start` ainda não chegou**; a marca de revogação prevalece sobre `start`/`beat` concorrentes para a mesma chave. Retê-la por pelo menos 120 s para bloquear requisições em trânsito. Reaceitação explícita cria uma chave nova.
- Visibilidade oculta, retirada do consentimento e `pagehide`: parar batidas imediatamente e tentar `leave` com `keepalive`. Se o evento não chegar, a expiração lógica exclui a aba após ~75 s. O painel pode atualizar a cada ~30 s; são **abas consentidas estimadas**, não pessoas únicas nem medição instantânea exata.
- `purge_after`: contador ignora imediatamente expirados/revogados; remoção **física** deve ser comprovada por limpeza limitada e segura com retenção máxima definida (proposta: até 1 h após `purge_after`). Postgres **não** apaga linhas só porque `expires_at` passou; não presumir scheduler habilitado. Verificar mecanismo de limpeza no ambiente isolado antes de GO.
- Corridas de duas instâncias: unicidade e transições condicionais devem ser transacionais no **mesmo** armazenamento compartilhado. Nenhum lock ou estado em memória do processo serve como garantia global.

## 4. Leitura exclusiva e proteção contra abuso

1. `GET` aplica `requireSupabaseAuth` (Bearer/JWT validado) **e** consulta atual de `public.user_roles` para `role='admin'` vinculada ao `userId`; ignorar `user_metadata`, flags da UI e papel informado pelo cliente. Anônimo = `401`; autenticado sem admin = `403`; ambos sem agregado ou diferença que revele contagem.
2. Apenas **depois** da checagem, a rota usa credencial privilegiada exclusivamente server-side para `COUNT` de leases ativos. Nada de `SELECT *`, IDs, estados ou listas no retorno. Erros = `503` e UI “indisponível”, jamais contagem zero inventada.
3. `POST` exige HTTPS e origem allowlist explícita, `Sec-Fetch-Site` quando presente, JSON estrito, tamanho limitado, método correto, `no-store` e **sem CORS público**. Esses cabeçalhos mitigam abuso no navegador, mas **não** autenticam robôs; não afirmar prevenção completa.
4. Limitação **compartilhada entre instâncias** de criação e frequência de heartbeat (no máximo uma renovação aceita a cada ~15 s por chave; quotas de novas chaves por origem de rede/edge, a calibrar em teste sintético). Não manter IP na tabela de presença. Se o WAF/gateway não fornecer limitação sem retenção indevida, o design precisa de alternativa específica em armazenamento efêmero, sujeita a avaliação de privacidade. Ataques que geram milhares de chaves continuam um risco residual; a métrica não pode ser vendida como auditoria de pessoas.
5. Proteção contra logs: redigir payloads, `Authorization`, chaves e erros internos; cabeçalhos não devem enviar tokens na URL. Segredos privados somente em ambiente servidor. Auditoria da **permissão** administrativa pode ser registrada sem conteúdo de visitantes.

## 5. Gates para uma homologação posterior, exclusivamente descartável

| Gate com identidades e abas sintéticas independentes | Critério de aceite |
| --- | --- |
| Consentimento e exclusões | Sem consentimento/aba oculta/rota privada: 0 POST; consentimento explícito: somente aquela aba sinaliza |
| Idempotência, TTL e duas instâncias | 2 abas = 2 leases; `beat` duplicado não conta duas vezes; ambos hosts veem igual agregado; expiração lógica <=75 s sem renovação |
| Revogação concorrente | `leave` antes/depois de `start` e durante `beat` nunca reativa chave; reconsentir com novo token funciona; purge físico comprovado |
| Admin apenas | Anon e técnico 401/403 sem contagem; admin com token válido **e papel atual** recebe só agregado; papel removido perde acesso sem depender de JWT antigo |
| Abuso e privacidade | Origem indevida, corpo extra, token inválido, replay, burst, falha de storage e limite de frequência são recusados; sem PII na tabela/log |
| Fail closed | Sem dependência/segredo/limiter, retorna indisponível; feature desativada; canal Realtime legado não é reaberto, RLS existente fica intacta |

**NO-GO até todos os gates novos passarem e houver autorização explícita para qualquer schema/infraestrutura oficial.** Preservar os resultados do workflow 44679755391; nenhuma reexecução de WebSocket, SQL oficial, merge, deploy ou configuração global nesta rodada.

Referências: [Supabase — segurança do Data API](https://supabase.com/docs/guides/api/securing-your-api), [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [revisão de viabilidade PR #344](./pr344-presenca-consentida-ingestao-servidor-20261120.md).
