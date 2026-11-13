# R1 — catálogo operacional único, sem Auth obrigatório (12/11/2026)

**Decisão vinculante:** [Issue #210, comentário 6840890168](https://github.com/hrq16000-a11y/encontreumtecnico/issues/210#issuecomment-6840890168). Não exigir reivindicação, login, aceite individual ou aprovação manual para que um cadastro administrativo/importado esteja **habilitado no catálogo operacional**. Não confundir habilitado com online, serviço confirmado ou telefone comprado.

## Estrutura proposta: estender o cadastro que já existe

- **ID único:** usar o `public.technicians.id` já referenciado por funis, perfis e direitos futuros. Nada de outra tabela de profissionais nem Auth inventado. O `user_id` passa a ser opcional apenas para cadastro sem reivindicação.
- **Ficha mínima:** nome e município podem ser nulos; telefone normalizado vai exclusivamente para `eut_moderation.catalog_private_contacts`, com FK pelo mesmo `technicians.id`, RLS ativo e nenhum grant de leitura ao browser. O DDD é somente sinal regional aproximado; não converte DDD em município.
- **Origem e identidade:** `catalog_origin` é coluna de classificação; a chave original `source_key` fica somente em `eut_moderation.catalog_provenance`, tabela privada 1:1 com o mesmo `technicians.id`, com índice único de origem/chave e RLS. Importar duas origens com mesmo nome ou telefone **não significa** automaticamente a mesma pessoa. Conflito de telefone na mesma origem exige edição explícita, sem sobrescrever.
- **Habilitação:** `catalog_enabled=true` por padrão **para novas fichas administrativas**; fichas legadas recebem `NULL` sem alteração em `updated_at` e preservam as regras antigas de status/bloqueios; não há backfill, alternável com RPC administrativa auditada, preservado em reimportações. O campo legado `status='pendente'` continua apenas por compatibilidade com gatilhos antigos; **não** é fila para conferência humana dos novos cadastros. A busca pública atual ainda filtra `status='aprovado'` e proíbe `user_id=NULL`: isso exige **cutover separado e testado antes de publicar as fichas**.
- **Lote:** RPC de até 50 itens por transação; repetir lote não cria contas, contatos ou auditorias duplicadas. Uma rejeição faz rollback da transação inteira. Para milhares de técnicos, paginar lotes; sem limite de aprovações individuais.
- **Regras:** administrador verificado e operacional valida no servidor; bloquear telefone restrito; motivo obrigatório; contato privado jamais em RPC, log ou SSR; auditoria inserida na mesma transação. Gravação não significa liberação paga.
- **Ligação posterior a Auth:** não transferir por telefone/nome isolado. Contrato de reivindicação deverá associar `user_id` opcional a uma ficha existente após prova de titularidade, preservando ID, origem, bloqueios e direito de retirada.
- **Compatibilidade:** os RPCs de contato por `user_id`, a elegibilidade pública que exige `user_id IS NOT NULL`, os gatilhos de slug/qualidade, o enum legado e os tipos TypeScript precisam de revisão e testes em staging real ANTES da aplicação. Não remover nem substituir diretamente as rotinas existentes.

## Esta micro-rodada: prova isolada, não implantação

Proposta SQL **não aplicada**: `docs/sql/eut-canonical-catalog-r1-proposal-20261112.sql`. Fixture PostgreSQL descartável baseada na fixture já existente do painel. Testes: anônimo/cliente negados, criação sem Auth e sem cidade/categoria inventadas, contato E.164 privado, duplicação por origem idempotente, origens diferentes não fundidas por telefone, lote, desabilitação com versão, preservação da desabilitação após reimportação, banimento, IBGE inválido e rollback de auditoria.

**Critérios para próxima rodada:** (1) compatibilidade real dos gatilhos, FKs, índices e RLS em staging com cópia sanitizada; (2) migração oficial com rollback e caminho de backfill dos contatos antigos; (3) interface administrativa para criar, pesquisar, editar, desabilitar e conferir após recarregar; (4) cutover público de busca seguro e sem números; (5) QA owner autenticado. Só depois considerar merge/deploy/migração real.

**Restrições:** não aplicar SQL no Supabase hospedado, não criar/alterar usuários, telefones, pagamentos, DNS, produção, WordPress ou Lovable. Este documento não declara o painel operacional.

## Compatibilidade comprovada com metadados reais (leitura)
O banco hospedado usa `technicians.public_slug NOT NULL`, trigger `eut_migration.assign_technician_public_slug()` (fallback `tecnico` e sufixo do UUID para perfis sem nome/cidade), e FK `user_id -> profiles.id`; o fixture antigo não reproduzia esses contratos. Novo fixture específico de CI os reproduz sem alterar o banco real. Os demais triggers e políticas ainda necessitam homologação em staging.

Correção: a versão anterior aceitava DDD inválido, assinante começando em 1 e texto/ramal removido silenciosamente; o contato privado antigo exige `+55[1-9]{2}[2-9][0-9]{7,8}`. O SQL proposto agora valida esse formato, rejeita lote SQL NULL e os testes conferem RLS/grants de contato, preservação dos contatos Auth existentes, slug sem telefone, criação mínima e segunda origem. Não afirmar que isso prova compatibilidade integral com os gatilhos reais.

**Pendente antes de ativar:** testar em staging também `eut_profile_security.block_unsafe_public_profile`, `eut_migration.guard_technician_approval`, `eut_validate_technician_city_and_coverage` e a política legada pública de `status='aprovado'`, além dos RPCs de contato e indicação por `user_id`. Não expor novas colunas de procedência em busca pública. Sem SQL aplicado no Supabase hospedado.

## Compatibilidade real verificada apenas por leitura — Supabase EUT

Os gatilhos instalados em `public.technicians` validam slug público, texto seguro, categorias/serviços, município/cobertura, bloqueios, qualidade de aprovação, bônus pioneiro e auditam somente mudanças de status/nome/bio/região. Não são removidos ou relaxados. Uma ficha Auth-less com status legado `pendente`, município e categoria opcionais não é perfil publicado, mas `catalog_enabled=true` registra habilitação operacional. O cutover público fica bloqueado até atualização segura da elegibilidade RLS/SSR.

As políticas de SELECT anônimo e a RPC `eut_visibility.eut_public_technician_eligible` excluem fichas Auth-less por `user_id IS NULL`, mesmo quando `catalog_enabled=true`. A API anônima de `technicians` tem grant de SELECT: por isso não podemos deixar uma chave de procedência na tabela pública. Ela foi migrada, nesta proposta de testes, para `eut_moderation.catalog_provenance`, restrita por RLS/grants, sem segundo catálogo.

O contato privado existente `public.eut_technician_private_contacts` continua vinculado a Auth e mantém o gatilho de banimento; a nova tabela privada de contato por ID canônico não dá `allow_paid_contact` e não altera entitlements. Para um contato realmente adquirido, serão necessários backend de pagamento PSP e checagem do direito, em etapa separada.

O gatilho legado de auditoria NÃO cobre `catalog_enabled`: o novo gatilho de mudança operacional bloqueia edição direta não auditada e exige administração operacional e motivo. O RPC de habilitação agora utiliza esse gatilho para gerar um único log transacional. `catalog_origin` e DDD não podem ser alterados informalmente. A migração não faz backfill: `NULL` continua sujeito a status e bloqueios, inclusive pendentes; novos cadastros manuais/importados continuam habilitados por padrão.

**Não executar esta proposta no banco real ainda:** o PostgreSQL descartável replica apenas parte dos gatilhos. Verificar em staging o funcionamento de todos os 10 gatilhos, políticas reais, grants, cronologia de migrações, rollback e tipos gerados antes de qualquer SQL de produção.


## R2: politicas e gatilhos reais testados em PostgreSQL isolado

Fixture reproduz funcoes instaladas de texto publico, municipio/cobertura, servicos, qualidade, bloqueio e elegibilidade; politicas permissivas SELECT/INSERT sao recriadas a partir de metadados de leitura. A proposta passa a exigir INSERT direto com user_id do proprio usuario (politica RESTRICTIVE) para impedir criacao Auth-less sem RPC administrativa auditada. As politicas publicas propostas deixam de ignorar catalog_enabled e a elegibilidade real quando combinadas por OR. Testes positivos e negativos verificam visibilidade anonima, criacao autorizada, tentativa de cliente de contornar RPC, contato em texto publico, municipio e servico invalidos e bloqueio legado. Nao e prova de staging real e nao modifica SQL hospedado.

## Micro-rodada: fidelidade dos 9 triggers, 10 políticas e rollback guardado

O metadado PostgreSQL instalado foi lido sem selecionar pessoas/contatos. O repositório reproduz agora os **9 triggers ativos de `public.technicians`**, mais o gatilho `eut_restrict_private_contact`, e **as dez políticas RLS originais** em um PostgreSQL 16 sintético, com funções extraídas por `pg_get_functiondef`. Há uma política nova, `eut_catalog_direct_insert_requires_owner`, testada separadamente após instalação da proposta. Fixtures auxiliares (Auth sintético, pioneer table e categorias) **não são réplica integral de staging**.

A proposta de migração foi alterada para `ADD catalog_enabled boolean` seguido de `SET DEFAULT true`, sem `UPDATE` nos antigos técnicos. Os legados mantêm `NULL` e o comportamento histórico de `status`/bloqueios. As políticas propostas usam `COALESCE(catalog_enabled,true)` **apenas junto** a `status='aprovado'` e `eut_public_technician_eligible`. Os cadastros Auth-less novos permanecem `pendente` no enum e, portanto, **não são publicados ainda**. Um cutover público posterior exige avaliação separada.

O rollback proposto é transacional e **recusa execução se existir qualquer cadastro Auth-less ou evento de auditoria R1**: nunca remove dados de técnicos existentes. Em uma segunda base PostgreSQL sem novos cadastros, restaura as 3 políticas modificadas, remove apenas objetos R1, recupera os `NOT NULL` originais e grava auditoria da reversão; valida linhas/telefones/timestamps antigos intactos. Não usar no Supabase hospedado sem backup/PITR, janela autorizada e revisão independente.

A main avançou além da base original da #256; a composição final da UI `admin.tsx` ainda precisa de QA isolado, sem alterar a main nesta rodada.
