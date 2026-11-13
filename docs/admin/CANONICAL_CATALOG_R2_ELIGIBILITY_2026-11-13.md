# R2 — elegibilidade pública de catálogo Auth-less (proposta, não implantação)

**Escopo:** continuação da PR Draft #256 no mesmo `public.technicians.id`. Contrato de compatibilidade: [comentário 6843327144](https://github.com/hrq16000-a11y/encontreumtecnico/pull/256#issuecomment-6843327144). Esta proposta **não foi aplicada no Supabase hospedado** e **não libera publicação**.

## O que o SQL R2 propõe (após R1)
- Preserva o predicado legado: Auth vinculado + `status='aprovado'` + conta e telefone sem bloqueios. `catalog_enabled=NULL` em legados não causa despublicação; `false` explícito bloqueia.
- Para **cadastro administrativo sem Auth**, exige simultaneamente `user_id=NULL`, `catalog_enabled=true`, `status='pendente'`, `catalog_origin` permitido, procedência privada 1:1 de origem correspondente e evento `catalog_created` auditado da RPC administrativa, com origem/habilitação/ausência de Auth conferidas. Impede status `rejeitado`/`suspenso` e quaisquer bloqueios telefônicos privados ativos. Somente `user_id IS NULL` **não** basta.
- Modifica em conjunto o predicado `eut_visibility`, as três policies de SELECT (permissiva, restritiva anon e restritiva authenticated) e a RPC existente `eut_public_eligible_technician_ids`, que continua retornando **somente UUID** de até 500 candidatos, sem número, procedência ou nota de bloqueio. O proprietário/administrador autenticado mantém o acesso legítimo de gestão.
- Não cria nova tabela de técnicos, Auth, pagamento, entitlement, consulta paralela, geolocalização presumida nem `service_role` no browser. Nenhum dos 99 cadastros externos históricos é migrado ou habilitado automaticamente.

## QA sintético no workflow R1 existente
Executar a proposta SQL R2 **somente depois dos testes R1 e do rollback guardado**, no PostgreSQL 17 descartável já criado por `.github/workflows/eut-canonical-catalog-r1.yml`. Os testes R1 existentes são pré-requisitos. Cobertura: Auth aprovado, conta bloqueada e suspensa; import administrativo válido sem nome/cidade; ausência/mismatch de procedência e auditoria; candidato histórico não verificado; `catalog_enabled=false/NULL`; Auth pendente; import rejeitado/suspenso; telefone bloqueado após cadastro e desbloqueio; RLS anon/cliente/admin e RPC somente IDs; ausência de contato/chave privada em tabela pública; indisponibilidade do contato pago Auth-less mesmo com entitlement sintético.

O QA é **PostgreSQL sintético**, não valida hosted Auth/GoTrue, RLS/grants reais após R1/R2 nem processo comercial real. Nenhum teste altera SQL/dados reais. Os testes não recriam nomes, telefones nem conteúdo dos 99 capturados.

## Bloqueios explícitos de liberação
1. **Corte SSR #255:** sua query ainda exige `status='aprovado'`, eliminando Auth-less `pendente` mesmo se a RPC R2 considerá-los elegíveis. O campo público `display_name` e a cidade podem ser `NULL`; adaptar projection e cartão para fallback neutro e sanitizado em PR separada/revisão específica. Não retornar origem/chave, número, DDD como cidade, status privado ou contato sem direito pago.
2. **IBGE:** o trigger legado `eut_validate_technician_city_and_coverage` só aceita cobertura quando `status='aprovado'`; R1 cria Auth-less `pendente` com `coverage_city_ids={}`, mesmo se cidade foi informada. **Sem município declarado/validado, não entra no filtro municipal #255.** Uma RPC futura, auditada, para declarar cobertura IBGE de perfil canônico exige projeto/teste próprio. DDD nunca se converte em município.
3. **Transação de release:** instalar R1/R2 sem coordenar SSR cria discrepância ou publicação prematura por REST direto. Exige staging isolado com backup/rollback/PITR, revisão de dono de funções, schemas expostos PostgREST, grants/colunas públicas, callbacks do marketplace, regras do legado e cenários negativos reais/sintéticos. Qualquer falha = negar visibilidade.
4. **Contatos:** `eut_reveal_paid_technician_contact` ainda usa `user_id`, não `catalog_private_contacts`. A R2 não modifica PSP, WhatsApp ou direitos pagos.
5. **Quarentena:** não usar coletas #200/#207/#208 para popular o catálogo; importação futura só por operação explícita da administração verificada, com auditoria/procedência e bloqueios aplicados.

**Próxima autorização necessária:** rodada independente de revisão do contrato de cutover SSR + RLS com fixtures (ou staging isolado autorizado, backup e rollback). Esta PR permanece Draft e não autoriza qualquer SQL hospedado, merge, deploy ou DNS.
