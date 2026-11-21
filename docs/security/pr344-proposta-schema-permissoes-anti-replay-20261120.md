# PR #344 — proposta mínima de schema privado, permissões e proteção contra replay

**Data:** 20/11/2026  
**Base examinada:** PR #344, HEAD `532b216d104843e7b144d18af53c2c9e3c69e21a`.  
**Status:** **PROPOSTA DOCUMENTAL, NÃO HOMOLOGADA — NO-GO**. Não é migration, SQL pronto para aplicar, autorização de DDL, mudança de RLS ou aprovação de ativação. **Nenhum SQL deve ser executado no Supabase oficial com base neste arquivo.** Não alterar as flags, main, dados, suspensos, Pioneiros, contatos, Realtime global ou produção.

## 1. Evidência existente, sem reexecução

- HTTP TanStack Start em Supabase descartável: H1–H4 aprovados no [run #44830108042](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44830108042). O run completo falhou inicialmente em H5; não o declarar verde integralmente.
- H5 corrigido e aprovado separadamente no [run #44830743904](https://github.com/hrq16000-a11y/encontreumtecnico/actions/runs/44830743904); a configuração sintética foi encerrada.
- O SQL atual `qa/pr344-http-leases-local.sql` cria SOMENTE `pr344_http_synthetic_leases`, `pr344_http_synthetic_budgets` e RPC de teste. O adaptador `src/lib/pr344-http-presence-local.server.ts` recusa Supabase que não seja `127.0.0.1`.
- **Lacuna comprovável por inspeção:** o `tabToken` atual é aleatório e não carrega validade absoluta autenticada pelo servidor. O `leave` grava tombstone temporário por 120 s. Depois de seu purge, um `start` com o mesmo token pode parecer uma nova aba, porque a chave não existe mais. Os H1–H5 não testaram replay *após* exclusão física; portanto, não provaram essa propriedade.

## 2. Escolha de armazenamento de menor impacto — **não executar**

O projeto usa `supabaseAdmin` via Data API. Para evitar introduzir conexão PostgreSQL direta neste momento, **candidata**: duas tabelas dedicadas em `public`, com **privacidade por grants + RLS + servidor**, não um schema fisicamente oculto. Essa escolha requer análise/autorizações posteriores; `public` continua sendo um schema exposto à API e não deve ser chamado de fisicamente privado.

### A. `public.eut_presence_leases` (estrutura lógica proposta)

| Campo | Tipo esperado | Regra |
| --- | --- | --- |
| `tab_hash` | `text` com 64 hex, chave primária | HMAC-SHA-256 de credencial de aba, calculado somente no servidor; jamais token em claro |
| `state` | `text` | `active` ou `revoked`; revogação monotônica |
| `issued_at` | `timestamptz NOT NULL` | Data autenticada pelo emissor servidor, não fornecida livremente pelo cliente |
| `hard_expires_at` | `timestamptz NOT NULL` | Validade absoluta imutável da credencial; **proposta inicial 15 min**, sujeita a homologação |
| `expires_at` | `timestamptz NOT NULL` | TTL lógico: menor entre `now()+75 s` e `hard_expires_at` |
| `last_beat_at` | `timestamptz NOT NULL` | Renovações compartilhadas com limite já testado de ~15 s |
| `purge_after` | `timestamptz NOT NULL` | Só elegível a exclusão **depois** de `hard_expires_at + margem de relógio/rede`; em revogação, respeitar também ao menos 120 s de tombstone |

Restrições: PK em `tab_hash`, `issued_at <= expires_at <= hard_expires_at` para estado ativo; `purge_after >= hard_expires_at + margem`; CHECK de estados; índices de `expires_at` (ativos) e `purge_after`. Estado revogado pode ter `expires_at` já vencido. Contagem administrativa: apenas `state='active' AND expires_at > now() AND hard_expires_at > now()`; jamais contar tombstones ou expirados. Uma aba consentida **não é** pessoa única.

Não guardar email, telefone, user ID, IP bruto, user-agent, URL, cidade, busca, dispositivo ou histórico de navegação. Os segredos HMAC e de assinatura ficam exclusivamente em ambiente servidor.

### B. `public.eut_presence_budgets` (estrutura lógica proposta)

| Campo | Tipo esperado | Regra |
| --- | --- | --- |
| `bucket_hash` | HMAC-SHA-256; chave primária | Identificador efêmero derivado de sinal de borda **confiável** e janela temporal; nunca IP bruto |
| `used` | `integer NOT NULL` | Contador de novas aberturas com limite transacional |
| `window_end_at` | `timestamptz NOT NULL` | Fim de janela não ampliável por chamadas repetidas |
| `purge_after` | `timestamptz NOT NULL` | Exclusão curta e obrigatória após janela/margem |

Serializar atualização por bucket e a transição por `tab_hash` na mesma transação para múltiplas instâncias. Repetir `start` para lease ativo **não** gasta nova quota; não usar `x-pr344-synthetic-network` como fonte de confiança em produção. Seleção da origem de rede/WAF e limiares **fora do escopo** desta proposta.

## 3. Matriz mínima de privilégios (a revisar antes de qualquer migration)

| Objeto / operação | `PUBLIC`, `anon`, `authenticated` | `service_role` no servidor | Browser/admin |
| --- | --- | --- | --- |
| `eut_presence_leases`: SELECT/INSERT/UPDATE/DELETE | **REVOKE ALL**, nenhuma política que habilite acesso | Somente os privilégios mínimos necessários | Sem acesso direto, nem para admin |
| `eut_presence_budgets`: SELECT/INSERT/UPDATE/DELETE | **REVOKE ALL**, nenhuma política que habilite acesso | Somente os privilégios mínimos necessários | Sem acesso direto |
| Função atômica de transição de leases + quota | **REVOKE EXECUTE** de `PUBLIC`, `anon` e `authenticated` | **GRANT EXECUTE** restrito ao papel servidor | Apenas `POST /api/presence/leases` |
| Função de purge limitada | **REVOKE EXECUTE** de `PUBLIC`, `anon`, `authenticated` | Executor interno privilegiado/agendado a autorizar | Nenhuma rota pública |
| Contagem agregada | Nenhum `SELECT` direto à tabela | Consulta `COUNT` somente após validação Auth e **papel admin atual** em `public.user_roles` | `GET /api/admin/presence/count` retorna somente número + instante |

Habilitar RLS em **ambas** as tabelas desde a mesma operação transacional que define os grants; **não** conceder políticas aos papéis públicos. Revisar os privilégios padrão existentes de tabelas, sequências e funções no schema `public`: a configuração atual de muitos projetos pode conceder acesso automaticamente. Não fazer `ALTER DEFAULT PRIVILEGES` global sem análise do impacto no restante do EUT: isso fica para autorização independente. `service_role` ignora RLS, portanto a verificação de admin deve acontecer no handler *antes* da consulta privilegiada.

Se for necessária uma RPC para transições, usar `SECURITY INVOKER`, `search_path` restrito/objetos totalmente qualificados e `EXECUTE` exclusivamente para o executor servidor. Não usar `SECURITY DEFINER` para contornar acesso. Nenhuma RPC deve devolver linhas, hashes, contadores de outros visitantes ou tokens.

Alternativa mais isolada — schema **não exposto** e conexão PostgreSQL privada/pooled — depende de outra interface e verificação de custo/credenciais: não presumir que `supabaseAdmin.from()` alcance objetos fora dos schemas Data API expostos.

## 4. Replay após limpeza: invariante que falta ao contrato atual

**O que NÃO resolve:** `tab_hash` HMAC sem validade absoluta; tombstone de 120 s isoladamente; `expires_at` renovável indefinidamente; timestamp `issued_at` fornecido pelo navegador sem assinatura. Após purge, esses controles não distinguem um token velho de outro novo.

**Proposta mínima de protocolo futuro (não implementada nesta PR/rodada):**

1. Após verificar consentimento, uma etapa de emissão *same-origin* do servidor entrega credencial de aba opaca, aleatória, com `issued_at`, `hard_expires_at`, versão/`kid` e MAC/assinatura autenticados pelo segredo **somente servidor**. Essa etapa pode ser adicionada ao mesmo endpoint HTTP com operação de emissão sujeita a rate limit; é **mudança de contrato**, não suportada pelos handlers atuais.
2. `start`, `beat` e `leave` devem exigir essa credencial e verificar assinatura, versão, validade absoluta e formato **antes** de qualquer operação de banco. Cliente não pode prolongar `hard_expires_at`; o servidor compara o prazo autenticado ao prazo imutável da linha.
3. `start` só cria lease enquanto a credencial emitida é válida. Retry do mesmo token ativo é idempotente; token revogado não pode voltar a `active`; `beat` jamais insere. `leave` prevalece sobre operações em trânsito, inclusive quando chega antes do primeiro `start`.
4. `purge_after >= hard_expires_at + margem` garante que uma credencial válida ainda encontrará sua marca de revogação. **Após purge, a credencial já expirou criptograficamente e é recusada mesmo com linha ausente**.
5. No vencimento absoluto, o navegador ainda consentido deve solicitar **nova credencial e nova chave**, sem reusar token antigo; a aba anterior expira logicamente. Ao retirar consentimento, não emitir nova credencial e enviar `leave` quando possível.
6. Rotação de segredo: identificar `kid` e manter chaves de verificação antigas somente até expirar a última credencial emitida com elas + margem; falha de verificação ou de disponibilidade = falha segura. Não registrar tokens/segredos em URLs, payloads de log ou eventos analíticos.

**Limite honesto:** visitantes anônimos podem iniciar *novas* solicitações falsas; nenhuma assinatura prova ser humano ou consentimento genuíno. Esse problema exige controle de abuso confiável separado. A solução proposta garante a rejeição de **credenciais antigas** depois de seu prazo, não impossibilidade de uma nova sessão anônima maliciosa.

**Impasse de compatibilidade:** os consumidores atuais enviam somente um token aleatório de 32 hex e recebem `204`; os testes H1–H5 validam exatamente isso. A emissão assinada exigirá contrato de resposta/cliente e novos gates dirigidos. Não afirmar que a proteção contra replay pós-purge está homologada hoje, nem trocar silenciosamente a semântica de `start`.

## 5. Limpeza e autorização futura (fora da execução atual)

- Contagem ignora expirados imediatamente, independentemente do scheduler. O purge **físico** remove batches limitados de leases apenas quando `purge_after <= now()` e também aplica a limpeza de buckets expirados.
- Definir o responsável por scheduling (Supabase Cron/pg_cron **se disponível e autorizado**, ou job autenticado equivalente), periodicidade, limites de lote, retenção e evidência de falha/atraso. Nada é criado ou habilitado agora.
- Antes de futura aprovação: revisar DDL final, grants de todas as roles, funções, privilégios default e RLS; validar emissão assinada/replay após purge, revogação concorrente, integridade da contagem, rate limit de borda e scheduler **em Supabase descartável**, somente cenários novos/afetados. Manter histórico H1–H5.
- Autorizações independentes requeridas: (a) novo contrato de emissão de credenciais, (b) storage/SQL/RLS oficial, (c) serviço de rate limit e limpeza, (d) eventual merge e deploy. Nenhuma é inferida deste documento.

**Decisão atual: NO-GO.** As flags `VITE_EUT_HTTP_PRESENCE_INGEST`, `VITE_EUT_HTTP_PRESENCE_ADMIN_READ`, `VITE_EUT_PRIVATE_REALTIME_PRESENCE` e flags de servidor seguem desligadas fora do runner descartável. Sem alterações em schema/RLS oficial, sem merge, deploy, ativação ou repetição de testes nesta rodada.

### Fontes verificadas
- [Contrato de leases da PR #344](./pr344-contrato-minimo-leases-presenca-isolada-20261120.md)
- [SQL de teste local](../../qa/pr344-http-leases-local.sql)
- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api) — `GRANT` e RLS são camadas distintas; defaults históricos podem conceder acesso e funções requerem `EXECUTE` restrito.
