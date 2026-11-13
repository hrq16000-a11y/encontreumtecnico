# R1 — catálogo operacional único, sem Auth obrigatório (12/11/2026)

**Decisão vinculante:** [Issue #210, comentário 6840890168](https://github.com/hrq16000-a11y/encontreumtecnico/issues/210#issuecomment-6840890168). Não exigir reivindicação, login, aceite individual ou aprovação manual para que um cadastro administrativo/importado esteja **habilitado no catálogo operacional**. Não confundir habilitado com online, serviço confirmado ou telefone comprado.

## Estrutura proposta: estender o cadastro que já existe

- **ID único:** usar o `public.technicians.id` já referenciado por funis, perfis e direitos futuros. Nada de outra tabela de profissionais nem Auth inventado. O `user_id` passa a ser opcional apenas para cadastro sem reivindicação.
- **Ficha mínima:** nome e município podem ser nulos; telefone normalizado vai exclusivamente para `eut_moderation.catalog_private_contacts`, com FK pelo mesmo `technicians.id`, RLS ativo e nenhum grant de leitura ao browser. O DDD é somente sinal regional aproximado; não converte DDD em município.
- **Origem e identidade:** `catalog_origin` + `catalog_source_key` é chave única de idempotência. Importar duas origens com mesmo nome ou telefone **não significa** automaticamente a mesma pessoa. Conflito de telefone na mesma origem exige edição explícita, sem sobrescrever.
- **Habilitação:** `catalog_enabled=true` por padrão, alternável com RPC administrativa auditada, preservado em reimportações. O campo legado `status='pendente'` continua apenas por compatibilidade com gatilhos antigos; **não** é fila para conferência humana dos novos cadastros. A busca pública atual ainda filtra `status='aprovado'` e proíbe `user_id=NULL`: isso exige **cutover separado e testado antes de publicar as fichas**.
- **Lote:** RPC de até 50 itens por transação; repetir lote não cria contas, contatos ou auditorias duplicadas. Uma rejeição faz rollback da transação inteira. Para milhares de técnicos, paginar lotes; sem limite de aprovações individuais.
- **Regras:** administrador verificado e operacional valida no servidor; bloquear telefone restrito; motivo obrigatório; contato privado jamais em RPC, log ou SSR; auditoria inserida na mesma transação. Gravação não significa liberação paga.
- **Ligação posterior a Auth:** não transferir por telefone/nome isolado. Contrato de reivindicação deverá associar `user_id` opcional a uma ficha existente após prova de titularidade, preservando ID, origem, bloqueios e direito de retirada.
- **Compatibilidade:** os RPCs de contato por `user_id`, a elegibilidade pública que exige `user_id IS NOT NULL`, os gatilhos de slug/qualidade, o enum legado e os tipos TypeScript precisam de revisão e testes em staging real ANTES da aplicação. Não remover nem substituir diretamente as rotinas existentes.

## Esta micro-rodada: prova isolada, não implantação

Proposta SQL **não aplicada**: `docs/sql/eut-canonical-catalog-r1-proposal-20261112.sql`. Fixture PostgreSQL descartável baseada na fixture já existente do painel. Testes: anônimo/cliente negados, criação sem Auth e sem cidade/categoria inventadas, contato E.164 privado, duplicação por origem idempotente, origens diferentes não fundidas por telefone, lote, desabilitação com versão, preservação da desabilitação após reimportação, banimento, IBGE inválido e rollback de auditoria.

**Critérios para próxima rodada:** (1) compatibilidade real dos gatilhos, FKs, índices e RLS em staging com cópia sanitizada; (2) migração oficial com rollback e caminho de backfill dos contatos antigos; (3) interface administrativa para criar, pesquisar, editar, desabilitar e conferir após recarregar; (4) cutover público de busca seguro e sem números; (5) QA owner autenticado. Só depois considerar merge/deploy/migração real.

**Restrições:** não aplicar SQL no Supabase hospedado, não criar/alterar usuários, telefones, pagamentos, DNS, produção, WordPress ou Lovable. Este documento não declara o painel operacional.
