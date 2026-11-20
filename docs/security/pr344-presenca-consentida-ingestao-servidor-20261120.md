# PR #344 — alternativa mínima: presença consentida ingerida pelo servidor (desenho, NO-GO)

**Escopo:** especificação apenas. Não há implementação, migration, execução SQL, mudança de RLS, configuração global, merge ou deploy nesta rodada. `VITE_EUT_PRIVATE_REALTIME_PRESENCE` segue desabilitada por padrão; o painel deve continuar exibindo presença suspensa. Não reutilizar nem alargar a política `SELECT` de `realtime.messages`.

## Motivo comprovado — não repetir os testes

- GitHub Actions [44679755391](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44679755391): Supabase local descartável; `private_only=true` verificado depois da janela de cache; encerramento local confirmado.
- P1/P2 **FALHA**: `CHANNEL_ERROR: Unauthorized: You do not have permissions to read from this Channel topic` ao conectar a sessão anônima ao canal `eut-consented-visitor-tabs-v2-private`. Sua permissão de `INSERT` não basta para ingressar no canal Presence privado.
- P3 **PASSOU**: técnico sintético impedido de ler o canal. P4_AUTH **observação positiva parcial**: admin sintético entrou no canal privado, fez `TRACK` próprio e leu sua própria presença.
- P4 **FALHA**: admin não observou uma presença do visitante que não pôde entrar. P5 **FALHA bloqueante**: sem `TRACK` anônimo bem-sucedido, revogação não pôde ser provada. P6 **PASSOU**: canal legado público rejeitado com `PrivateOnly`.
- Resultado do job: 2 aprovações, 3 falhas, 1 teste cancelado por timeout. **NO-GO** para ativar presença ou retirar a PR de draft. O cenário admin/visitante e a revogação permanecem sem homologação positiva.

## Escolha mínima: leases de abas no backend, sem WebSocket do visitante

Uma função HTTP do TanStack Start recebe somente sinais voluntários das abas visíveis; um armazenamento compartilhado e privado guarda **leases temporários**; uma função autenticada devolve ao painel **apenas a quantidade de abas consentidas ativas**. Não há acesso público a contagens, estados ou outros visitantes.

1. **Navegador:** reaproveitar `canShareAnonymousPresence(pathname, consent)`, `eut-cookie-consent.presence === true`, exclusões de rotas privadas e `document.visibilityState === 'visible'`. Sem consentimento, **zero chamadas**. Com consentimento, gerar identificador aleatório de aba (>=128 bits, não persistente entre sessões) em `sessionStorage`; nunca enviar identidade, IP, localização exata, URL, texto de busca ou telefone. Fazer `POST` inicial e renovação a cada ~25 s enquanto a aba estiver visível.
2. **Ingestão:** um único handler HTTP same-origin, exclusivamente servidor, com operações `start/beat/leave`; validar `Origin` exato, `Sec-Fetch-Site` quando presente, método e corpo pequeno (<=1 KiB), `presence === true`, formato da chave e limitador de abuso compartilhado. Aceitar que consentimento anônimo é uma **declaração do navegador**, não prova de identidade humana. Sem CORS público. A chave de aba atua como capacidade de renovação/revogação; guardar apenas seu hash com segredo de servidor.
3. **Armazenamento:** coleção/tabela **privada e dedicada**, com chave única de aba e expiração (`expires_at = now + ~70 s`), escrita `upsert` atômica e expiração consultada em cada leitura. Não utilizar memória por instância da Vercel, `search_events`, tabelas de contatos ou `realtime.messages` como armazenamento de leases: memória não agrega instâncias; buscas não equivalem a presença. **Não há armazenamento compartilhado de leases comprovado no código atual.** Opção preferencial para futura implementação: tabela mínima no Supabase em schema não exposto, após contrato/migration e autorização separados; não criar SQL nesta PR/rodada. Se isso não for autorizado, a presença permanece suspensa.
4. **Consulta administrativa:** handler `GET` separado valida a identidade pelo Auth no servidor e confere o papel `admin` contra a autoridade persistente, antes de qualquer leitura. Resposta `{ activeConsentedTabs, checkedAt }` e `Cache-Control: no-store` somente ao admin; anônimo, técnico e demais papéis recebem recusa, sem números ou indícios de atividade. Chaves privilegiadas ficam somente no servidor; chamadas privilegiadas não podem depender apenas de um controle visual/flag, pois `service_role` ignora RLS. Não expor endpoint de lista de abas. O servidor não faz proxy de autenticação de visitante para canal Realtime.
5. **Saída e falhas:** na revogação, mudança para aba oculta e `pagehide`, interromper batidas e tentar `leave` com `keepalive`; o TTL remove presença residual mesmo se a requisição não chegar. Sem consentimento renovado, não retomar. Falha de gravação/leitura exibe **indisponível**, nunca inventa `0` ou pessoa online. Separar flag de ingestão e flag de exibição; ambas desligadas até gates e autorização. Sem WebSocket anônimo; a leitura administrativa pode fazer polling de ~30 s.

## Contrato mínimo para a futura homologação isolada (não executada)

| Gate | Resultado exigido |
| --- | --- |
| Consentimento | `presence=false`/ausente, rotas privadas e aba oculta nunca enviam heartbeat; reaceite explícito habilita somente a própria aba. |
| Dedupe/expiração | Duas sessões independentes = duas abas; renovações repetidas não inflacionam; TTL expira sem limpeza manual; teste em duas instâncias de servidor. |
| Privacidade | Payload e armazenamento não contêm identidade, IP, localização, telefone ou navegação; `leave`/revogação reduz contagem; ausência de `leave` expira em <=70 s + margem de consulta. |
| Autorização | Anônimo/técnico recebem 401/403 no GET e nenhum agregado; apenas admin legitimamente autenticado lê contagem; falsificação de papel, CORS e chave inválida são recusados. |
| Robustez | Rate limit, repetição, concorrência, falha do backend e tentativas de inflação verificadas; sem estatística enganosa nem contagem cross-tenant. |
| Não regressão | `realtime.messages` RLS/`SELECT` admin-only intocadas, publicador anônimo sem Realtime, canal v1 inacessível, flag desabilitada, consumidores técnicos e `search_events` intactos. |

## Gate de mudança global / decisão

**NO-GO permanece**, mesmo com esta documentação. Para passar a GO depois, exigem-se: (a) autorização específica de eventual storage/migration e credenciais somente de servidor; (b) implementação revisada; (c) gates isolados acima verdes, inclusive revogação e múltiplas sessões; (d) inventário externo e janela/rollback da configuração global `Allow public access`; (e) autorização separada para qualquer alteração oficial. Não ativar feature flag nem desativar acesso público global com base apenas em testes estáticos. Nenhum teste prévio precisa ser repetido nesta rodada.
