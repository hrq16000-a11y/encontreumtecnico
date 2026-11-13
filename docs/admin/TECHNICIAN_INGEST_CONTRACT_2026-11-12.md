# P0 — Contrato server-only de ingestão no catálogo ÚNICO

**Não instalado no Supabase hospedado; não é botão de importação nem cria técnicos hoje.**

`src/lib/server/technician-ingest-contract.ts` transforma registros legítimos com DDD+telefone mínimo em um conjunto privado de instruções para futura RPC transacional no mesmo catálogo `public.technicians`. Novos registros nascem `enabled=true` sem exigir reivindicação, conta Auth, verificação ou aprovação manual. A origem e ID externo estável proporcionam deduplicação idempotente. Bloqueios e desabilitações feitas pelo admin não são revertidos pela importação. Divergências de telefone e identidade são isoladas em quarentena de CONFLITOS, sem bloquear todo o lote.

`privateWrites` contém telefone E.164 e **jamais** deve retornar para cliente, SSR, analytics ou logs. `summary` contém apenas índices e códigos sem PII. Um número compartilhado entre fontes distintas não prova identidade nem deve consolidar profissionais automaticamente. O DDD é apenas regional, não cidade comprovada; cidade fornecida exige código IBGE que o writer no servidor deverá conferir no cadastro oficial.

**Bloqueio real para efetivar:** o schema atual exige `technicians.user_id`, `display_name` e `city` não nulos; contatos privados dependem de `user_id`. Qualidade, município e slug são protegidos por gatilhos existentes. É preciso homologar uma evolução compatível da estrutura atual e dos triggers em PostgreSQL descartável, mapear `(origin,source_id)` para `technicians.id` com unicidade, preservar os dados Auth e vincular contato privado por `technician_id`, sem segunda tabela de técnicos. **Nenhuma migração é autorizada por este contrato.**

Pagamento: ainda sem PSP/webhook validado; jamais liberar telefone antes de entitlement real. Regra de produto futura: até 2 contatos por compra. Ranking: preservar a indicação e relevância regional; não deduzir vínculo por telefone.

Teste atual: fixtures sintéticas de idempotência, número compartilhado, origens, desabilitação, banimentos, privacidade, DDD, IBGE e lotes parciais. Ainda faltam RLS/RPC, revalidação no servidor, rollback, gravação, busca e QA reais antes de ativar.
