# Issue #226 — Inventário de reconciliação Supabase → GitHub (somente metadados)

**Data de referência:** 12/11/2026 (America/Sao_Paulo). **Projeto de banco:** `Encontre um Técnico Admin`, ID público do projeto `pqtzhctvjbfcunmrvxne`. **Repositório:** `hrq16000-a11y/encontreumtecnico`. **GitHub main consultada:** `25c973ab8f62490f7ba7d215c7715bf9ac16bd85`.

> DOCUMENTO NÃO EXECUTÁVEL. Contém apenas identificadores de versões, nomes e caminhos de arquivos. Não contém comandos SQL, payloads, dados pessoais, credenciais, identificadores de contas, telefones, e-mails, backups ou conteúdo de tabelas. Não autoriza criação, exclusão ou reaplicação de migrations.

## Resultado verificado

| Indicador | Quantidade | Origem da evidência |
|---|---:|---|
| Versões **já registradas como aplicadas** | **66** | API de metadados `list_migrations`, projeto dedicado |
| Arquivos SQL encontrados em `supabase/migrations/` na main | **6** | Árvore do commit `25c973ab8f62` |
| Versões registradas no banco **sem arquivo correspondente por prefixo de versão** | **60** | Confronto exato dos 14 dígitos |
| Arquivos versionados com prefixo ausente da lista aplicada | **0** | Confronto exato |
| Scripts de referência em `docs/sql/` (fora de migrations) | **30** | Árvore Git, **24** na raiz e **6** em `tests/` |
| Versões duplicadas na lista do Supabase | **0** | Comparação dos identificadores |

**Interpretação:** ausência de arquivos históricos no Git **não implica** ausência das alterações no banco. A existência de arquivos em `docs/sql/` **não é prova** de que sejam iguais às migrations aplicadas ou de que devam ser executados. Mesmo os 6 arquivos com prefixo correspondente ainda precisam de validação de conteúdo e procedência antes de qualquer declaração de equivalência integral.

## Quais migrations aparecem no histórico aplicado

A coluna de arquivo verifica **somente a presença de nome/prefixo** na main; não valida conteúdo, RLS ou hash do SQL.

| Versão aplicada | Nome registrado no Supabase | Arquivo de migration no Git |
|---|---|---|
| `20261109004508` | `a4220d71-e7ec-4faf-bba2-d91920291a31` | `supabase/migrations/20261109004508_a4220d71-e7ec-4faf-bba2-d91920291a31.sql` |
| `20261109004611` | `54748732-71c6-4f32-a53f-035ab1d3126a` | `supabase/migrations/20261109004611_54748732-71c6-4f32-a53f-035ab1d3126a.sql` |
| `20261109010602` | `c4a4c29c-c89b-4490-8b34-4077bd8fa363` | `supabase/migrations/20261109010602_c4a4c29c-c89b-4490-8b34-4077bd8fa363.sql` |
| `20261109010936` | `0202e169-bab4-40ea-9a3a-344d485ef8da` | `supabase/migrations/20261109010936_0202e169-bab4-40ea-9a3a-344d485ef8da.sql` |
| `20261109012246` | `eut_private_wordpress_staging_20261108` | **Sem arquivo de migration na main** |
| `20261109014808` | `eut_admin_legacy_review_index_20261109` | **Sem arquivo de migration na main** |
| `20261109015145` | `cae0c180-0d2f-4246-8d79-858115752b30` | `supabase/migrations/20261109015145_cae0c180-0d2f-4246-8d79-858115752b30.sql` |
| `20261109015335` | `bd2ffcf1-f2f2-4fcb-a93a-166b6579c55b` | `supabase/migrations/20261109015335_bd2ffcf1-f2f2-4fcb-a93a-166b6579c55b.sql` |
| `20261109040240` | `eut_verified_legacy_claims_and_review_r3_20261109` | **Sem arquivo de migration na main** |
| `20261109041716` | `eut_r4_google_only_admin_claim_safety_20261109` | **Sem arquivo de migration na main** |
| `20261109041753` | `eut_r4_google_claim_policy_jwt_access_fix_20261109` | **Sem arquivo de migration na main** |
| `20261109041918` | `eut_r4_google_only_account_types_and_owner_email_proof_20261109` | **Sem arquivo de migration na main** |
| `20261109042318` | `eut_r4_fix_recursive_rls_claim_quota_trigger_20261109` | **Sem arquivo de migration na main** |
| `20261109043730` | `eut_r5_wordpress_locality_quality_non_destructive_20261109` | **Sem arquivo de migration na main** |
| `20261109043939` | `eut_r5_restore_wordpress_sector_taxonomies_20261109` | **Sem arquivo de migration na main** |
| `20261109050359` | `eut_r5_no_country_as_city_before_public_approval_20261109` | **Sem arquivo de migration na main** |
| `20261109050547` | `eut_r5_private_ddd_aggregate_no_personal_contacts_20261109` | **Sem arquivo de migration na main** |
| `20261109051143` | `eut_r6_public_historical_archive_readonly_20261109` | **Sem arquivo de migration na main** |
| `20261109172951` | `eut_service_taxonomy_and_geography_admin_only_20261109` | **Sem arquivo de migration na main** |
| `20261109173053` | `eut_catalog_fix_anon_select_policy_separation_20261109` | **Sem arquivo de migration na main** |
| `20261109173153` | `eut_management_review_guardrails_and_editable_fields_20261109` | **Sem arquivo de migration na main** |
| `20261109174141` | `eut_claim_uses_confirmed_services_and_location_only_20261109` | **Sem arquivo de migration na main** |
| `20261109175135` | `eut_dynamic_filters_and_multiple_coverage_20261109` | **Sem arquivo de migration na main** |
| `20261109175657` | `eut_claim_copies_confirmed_uf_and_neighborhood_20261109` | **Sem arquivo de migration na main** |
| `20261109192140` | `eut_verified_email_password_role_choice_20261109` | **Sem arquivo de migration na main** |
| `20261109192241` | `eut_pending_claim_verified_password_tech_20261109` | **Sem arquivo de migration na main** |
| `20261109193711` | `eut_verified_email_private_legacy_lookup_20261109` | **Sem arquivo de migration na main** |
| `20261109200126` | `eut_stage_912_accounts_by_role_for_owner_activation_20261109` | **Sem arquivo de migration na main** |
| `20261109200317` | `eut_verified_legacy_account_activation_rpc_20261109` | **Sem arquivo de migration na main** |
| `20261109200358` | `eut_complete_legacy_claim_with_verified_password_identity_20261109` | **Sem arquivo de migration na main** |
| `20261109201057` | `eut_one_time_verified_wordpress_admin_bootstrap_20261109` | **Sem arquivo de migration na main** |
| `20261109201452` | `eut_safe_public_historical_wordpress_paths_v2_20261109` | **Sem arquivo de migration na main** |
| `20261109203155` | `eut_wordpress_specific_sector_evidence_review_only_20261109` | **Sem arquivo de migration na main** |
| `20261109203954` | `eut_private_media_bucket_and_transfer_queue_20261109` | **Sem arquivo de migration na main** |
| `20261109221030` | `eut_technician_specific_service_slugs_with_catalog_validation_20261109` | **Sem arquivo de migration na main** |
| `20261109222732` | `eut_block_legacy_account_role_mismatch_20261109` | **Sem arquivo de migration na main** |
| `20261110000735` | `eut_real_candidate_avatar_evidence_from_nov09_xml_zip` | **Sem arquivo de migration na main** |
| `20261110002510` | `eut_atomic_self_service_legacy_role_account_and_professional_claim_20261109` | **Sem arquivo de migration na main** |
| `20261110003405` | `eut_self_published_complete_technician_profile_without_admin_review_20261109` | **Sem arquivo de migration na main** |
| `20261110010242` | `eut_optional_technician_presence_heartbeat_private_20261110` | **Sem arquivo de migration na main** |
| `20261110010442` | `eut_presence_batched_public_lookup_no_enumeration_20261110` | **Sem arquivo de migration na main** |
| `20261110011433` | `eut_opt_in_technician_referral_missions_no_fabricated_reward_20261109` | **Sem arquivo de migration na main** |
| `20261110013046` | `eut_secure_unpaid_requests_and_contact_quote_20261109` | **Sem arquivo de migration na main** |
| `20261110014712` | `eut_private_technician_whatsapp_and_paid_entitlement_read_20261109` | **Sem arquivo de migration na main** |
| `20261110023216` | `eut_opt_in_direct_technician_requests_20261109` | **Sem arquivo de migration na main** |
| `20261110024447` | `eut_direct_request_private_replies_20261109` | **Sem arquivo de migration na main** |
| `20261110025905` | `eut_project_owner_bootstrap_20261109` | **Sem arquivo de migration na main** |
| `20261110033818` | `eut_ads_r2_private_foundation_20261110` | **Sem arquivo de migration na main** |
| `20261110035800` | `eut_ads_r3_admin_crud_private_assets_20261110` | **Sem arquivo de migration na main** |
| `20261110040944` | `eut_ads_r4_approved_public_cards_20261110` | **Sem arquivo de migration na main** |
| `20261110042554` | `eut_ads_r5_approved_image_delivery_20261110` | **Sem arquivo de migration na main** |
| `20261110045442` | `eut_legacy_claims_real_profiles_guard_20261110` | **Sem arquivo de migration na main** |
| `20261110181617` | `eut_pioneers_native_pre_registration_20261110` | **Sem arquivo de migration na main** |
| `20261110182437` | `eut_pioneers_secure_verified_claim_bronze_20261110` | **Sem arquivo de migration na main** |
| `20261110184534` | `eut_native_role_choice_not_wp_historical_rule_20261110` | **Sem arquivo de migration na main** |
| `20261110184929` | `eut_pioneer_role_not_legacy_requirement_20261110` | **Sem arquivo de migration na main** |
| `20261110220247` | `eut_private_moderation_guards` | **Sem arquivo de migration na main** |
| `20261110221557` | `eut_admin_contacts_center_v1` | **Sem arquivo de migration na main** |
| `20261110221912` | `eut_admin_contacts_audit_actor_v2` | **Sem arquivo de migration na main** |
| `20261110222144` | `eut_moderation_allow_private_contact_disable` | **Sem arquivo de migration na main** |
| `20261111065634` | `eut_protect_public_bio_contact_quarantine_20261111` | **Sem arquivo de migration na main** |
| `20261111075718` | `eut_admin_own_technician_role_20261111` | **Sem arquivo de migration na main** |
| `20261111081500` | `eut_admin_member_invitations_20261111` | **Sem arquivo de migration na main** |
| `20261111154543` | `eut_member_invite_actor_lock_20261111` | **Sem arquivo de migration na main** |
| `20261111163136` | `eut_admin_client_insights_20261111` | **Sem arquivo de migration na main** |
| `20261112003518` | `eut_public_eligibility_guarded_ssr_20261112` | **Sem arquivo de migration na main** |

## Inventário dos scripts de referência, **não executados nesta auditoria**

A categoria abaixo é inferida **somente pelo caminho e nome do arquivo**. Não significa que o SQL seja seguro, atual, equivalente a uma migration ou executado no banco. Mantenha esses arquivos fora de `supabase/migrations/` até proveniência demonstrada.

| Caminho no Git | Classificação preliminar | Status de equivalência |
|---|---|---|
| `docs/sql/eut-admin-accounts-moderation-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-admin-client-insights-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-admin-legacy-employer-overlay-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-admin-management-actions-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-admin-member-invitations-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-admin-self-technician-role-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql` | Proposta/preparação | Não comprova execução / equivalência |
| `docs/sql/eut-ads-r2-private-foundation.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-ads-r3-admin-rpcs.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-ads-r4-approved-public-cards.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-choose-new-role-without-wp-rule.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-contact-purchase-preparation.sql` | Proposta/preparação | Não comprova execução / equivalência |
| `docs/sql/eut-direct-flow-readiness-readonly.sql` | Consulta nomeada read-only | Não comprova execução / equivalência |
| `docs/sql/eut-legacy-claims-real-profiles-guard-20261110.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-member-invite-actor-lock-20261111.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-operational-readiness-readonly.sql` | Consulta nomeada read-only | Não comprova execução / equivalência |
| `docs/sql/eut-pioneer-verified-claim-and-bronze.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-pioneers-native-pre-registry.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-project-owner-bootstrap.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql` | Proposta/preparação | Não comprova execução / equivalência |
| `docs/sql/eut-public-referral-highlights-20261110.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-technician-public-slugs-20261110.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-verified-city-coverage-avatars-20261110.sql` | Referência não validada | Não comprova execução / equivalência |
| `docs/sql/eut-wordpress-parity-readonly.sql` | Consulta nomeada read-only | Não comprova execução / equivalência |
| `docs/sql/tests/eut-admin-crud-ephemeral-assertions-20261111.sql` | Teste/isolado | Não comprova execução / equivalência |
| `docs/sql/tests/eut-admin-crud-ephemeral-schema-20261111.sql` | Teste/isolado | Não comprova execução / equivalência |
| `docs/sql/tests/eut-ads-r2-verify.sql` | Teste/isolado | Não comprova execução / equivalência |
| `docs/sql/tests/eut-ads-r3-rollback-tests.sql` | Teste/isolado | Não comprova execução / equivalência |
| `docs/sql/tests/eut-ads-r4-rollback-delivery.sql` | Teste/isolado | Não comprova execução / equivalência |
| `docs/sql/tests/eut-legacy-claims-real-profiles-rollback.sql` | Teste/isolado | Não comprova execução / equivalência |

## Candidatos temáticos para conciliação documental (não equivalência)

As seguintes associações vêm de semelhança nominal e **não** foram aprovadas como fonte SQL das migrations. Não copiar nem renomear como arquivos executáveis.

| Versão + nome aplicado | SQL no repositório | Evidência |
|---|---|---|
| `20261110033818` — `eut_ads_r2_private_foundation_20261110` | `docs/sql/eut-ads-r2-private-foundation.sql` | Relação sugerida apenas pelo nome |
| `20261110035800` — `eut_ads_r3_admin_crud_private_assets_20261110` | `docs/sql/eut-ads-r3-admin-rpcs.sql` | Relação sugerida apenas pelo nome |
| `20261110040944` — `eut_ads_r4_approved_public_cards_20261110` | `docs/sql/eut-ads-r4-approved-public-cards.sql` | Relação sugerida apenas pelo nome |
| `20261110045442` — `eut_legacy_claims_real_profiles_guard_20261110` | `docs/sql/eut-legacy-claims-real-profiles-guard-20261110.sql` | Relação sugerida apenas pelo nome |
| `20261110025905` — `eut_project_owner_bootstrap_20261109` | `docs/sql/eut-project-owner-bootstrap.sql` | Relação sugerida apenas pelo nome |
| `20261110181617` — `eut_pioneers_native_pre_registration_20261110` | `docs/sql/eut-pioneers-native-pre-registry.sql` | Relação sugerida apenas pelo nome |
| `20261110182437` — `eut_pioneers_secure_verified_claim_bronze_20261110` | `docs/sql/eut-pioneer-verified-claim-and-bronze.sql` | Relação sugerida apenas pelo nome |
| `20261110184534` — `eut_native_role_choice_not_wp_historical_rule_20261110` | `docs/sql/eut-choose-new-role-without-wp-rule.sql` | Relação sugerida apenas pelo nome |
| `20261111075718` — `eut_admin_own_technician_role_20261111` | `docs/sql/eut-admin-self-technician-role-20261111.sql` | Relação sugerida apenas pelo nome |
| `20261111081500` — `eut_admin_member_invitations_20261111` | `docs/sql/eut-admin-member-invitations-20261111.sql` | Relação sugerida apenas pelo nome |
| `20261111154543` — `eut_member_invite_actor_lock_20261111` | `docs/sql/eut-member-invite-actor-lock-20261111.sql` | Relação sugerida apenas pelo nome |
| `20261111163136` — `eut_admin_client_insights_20261111` | `docs/sql/eut-admin-client-insights-20261111.sql` | Relação sugerida apenas pelo nome |

## Governança de PRs antigas — evidências verificadas

- **#4** — `scripts/auditar_pacote_eut.py` e `docs/MIGRACAO_INVENTARIO_2026-11-08.md` ainda não constam da main. Preservar para revisão: há verificações únicas de pacote e mídias.
- **#5** — `scripts/verificar_staging_wordpress.sql` e `docs/WORDPRESS_STAGING_VALIDADO_2026-11-08.md` não constam da main; o verificador inclui métricas de órfãos e conteúdo histórico que não está completamente reproduzido nos scripts atuais `docs/sql/eut-wordpress-parity-readonly.sql` e `docs/sql/eut-operational-readiness-readonly.sql`. **Não encerrar automaticamente**.
- **#26** — na main faltam `src/lib/catalog-filters.ts` e `src/components/eut-coverage-manager.tsx`; há sobreposição parcial com filtros atuais, mas não evidência de equivalência integral. Preservar sem merge.
- **#66** — `src/lib/legacy-cutover.test.ts` não consta da main; SQL de backfill histórico permanece explicitamente isolado. Não absorver alterações ou aplicar SQL.
- **#74** — `src/lib/technician-identity-display.ts` não consta da main; proposta de identificador de contato requer política específica de privacidade. Preservar sem ativação.
- **#81/#133/#139/#142/#145/#146/#156/#200/#207/#208** — propostas de publicidade, autenticação, pagamento e importação que exigem seus próprios gates; não há prova de obsolescência integral nesta rodada.
- **#20** — encerrada em rodada anterior, por reintroduzir fluxo de login incompatível; não realizar novos fechamentos sem prova de substituição.

## Pendente / critérios de encerramento da Issue #226

1. Localizar para as **60 versões sem arquivo** a fonte histórica confiável ou indicar explicitamente `origem ausente` sem inventar DDL. O nome da migration não é a definição do schema.
2. Verificar o conteúdo/hashes das **6 versões com nome correspondente**, sem executá-las.
3. Confirmar se cada script `docs/sql/` foi aplicado, parcialmente aplicado, apenas proposto ou usado somente em teste, com registros verificáveis — não concluir pelo nome.
4. Avaliar drift e RLS em consulta **somente leitura** em rodada própria; diferenciar `public`, `eut_migration`, `auth` e outras áreas privadas.
5. Só propor regularização histórica e testes PostgreSQL descartáveis em PR separado e revisão aprovada. **Nenhuma gravação, reaplicação, limpeza destrutiva ou lançamento na produção nesta fase**.

**Ambientes preservados:** Supabase, Vercel produção, DNS, WordPress, Lovable, backups, branches, mídias, Auth e dados reais. Sem merge ou deployment por esta auditoria.

---

## Rodada 2 — verificação efetiva de arquivos e recuperação de evidências (12/11/2026)

**Esta seção substitui a classificação *preliminar por nome* da rodada 1 acima.** Nenhum script desta rodada foi executado. Os 36 arquivos foram **lidos estaticamente** por conteúdo no commit de referência `c5611ecf599d738ffdf6f3e15eec616654864181` (6 migrations e 30 scripts de `docs/sql/`). O histórico de versões aplicadas foi novamente consultado via API de metadados do Supabase, permanecendo em **66**; esta API fornece **versão e nome**, mas **não devolve o corpo ou hash do SQL efetivamente executado**.

### 2.1 Integridade Git e conteúdo dos seis arquivos

Todos os seis identificadores de 14 dígitos constam da lista de migrations aplicada. A comparação exata dos hashes **Git Blob** entre `main` e `lovable-sync` retornou **6/6 iguais**. Inspeção das árvores de cinco branches históricas de backup também revelou **os mesmos seis caminhos**, sem cópias novas das 60 migrations ausentes. Isso verifica integridade **entre refs Git**, não integridade frente ao SQL histórico do servidor.

| Versão | Git Blob SHA-1 observado na main | Commit histórico que tocou migrations | Linhas | Escopo observado por leitura |
|---|---|---|---:|---|
| `20261109004508` | `1d1242e16ffa6933d81f3344512d2e7e64ced6df` | [commit `2576dd45d`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/2576dd45dde8cda4a0043a5d18efd3fbd30be839) | 102 | Tipos e tabelas base; funções com SECURITY DEFINER |
| `20261109004611` | `b1141366493a866f34912ab9a2edfb8cc5a1acca` | [commit `8277c05be`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/8277c05be150c07807e7588b413b201414838330) | 3 | REVOKE/GRANT de execução em funções |
| `20261109010602` | `9e67adff75c0cf3e4d67b1cc8f4b75624c43a9a6` | [commit `e359df561`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/e359df5611ab0dc9c163887164bb5007c4b2e50f) | 60 | Tabela de solicitações e controles de acesso |
| `20261109010936` | `590b199cdf451ea377014d6cda4fb6f4b01719b0` | [commit `48b53ba04`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/48b53ba045c40306d34453201ae1ac8bcd485fa3) | 18 | Tabela de mensagens de contato e permissões |
| `20261109015145` | `1a2a98756ffef8c69b15a89e16302440efdd436b` | [commit `ec25b1db5`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/ec25b1db5a459a6e50ea70cbb08c8d496c0e9ea3) | 19 | Eventos de busca e permissões/RLS |
| `20261109015335` | `f0146638f8d250edce67b3de0dfb2810ebbba7e8` | [commit `3df52fde6`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/3df52fde679c9fd4b1c9ec0af08180ee23f1ccfd) | 4 | Função e triggers de bootstrap administrativo |

**Limite essencial:** nenhum desses seis hashes pode ser comparado ao conteúdo do SQL aplicado somente com `list_migrations`. Os commits históricos são evidência da origem dos **arquivos Git**, não prova de que os corpos sejam iguais ao estado atual do banco.

### 2.2 Classificação dos 30 arquivos de `docs/sql/` após inspeção do conteúdo

A classificação distingue **estado do arquivo**, **registro de versão aplicada**, e **igualdade de SQL**, que são coisas distintas. `Versão temática registrada` significa apenas que há um registro aplicado com nome relacionado no Supabase; não garante que o script do Git seja cópia integral daquela migration. Nenhum arquivo foi promovido a `supabase/migrations/`.

| Arquivo | Classe comprovável | Versão relacionada, se existente | Evidência e limitação |
|---|---|---|---|
| `docs/sql/eut-admin-accounts-moderation-20261111.sql` | DDL sem proveniência conclusiva | Não atribuída | DDL de moderação; nenhuma versão de mesmo nome comprovada |
| `docs/sql/eut-admin-client-insights-20261111.sql` | Versão temática registrada | `20261111163136` — `eut_admin_client_insights_20261111` | Cria RPC; versão do tema consta aplicada |
| `docs/sql/eut-admin-legacy-employer-overlay-20261111.sql` | DDL sem proveniência conclusiva | Não atribuída | DDL de overlay histórico; sem comprovante de execução |
| `docs/sql/eut-admin-management-actions-20261111.sql` | DDL sem proveniência conclusiva | Não atribuída | DDL/RPCs de administração; não há correspondência inequívoca |
| `docs/sql/eut-admin-member-invitations-20261111.sql` | Versão temática registrada | `20261111081500` — `eut_admin_member_invitations_20261111` | Contrato de convite e versão temática aplicada |
| `docs/sql/eut-admin-self-technician-role-20261111.sql` | Versão temática registrada | `20261111075718` — `eut_admin_own_technician_role_20261111` | Contrato de papel técnico de admin e versão temática |
| `docs/sql/eut-admin-technician-crud-staging-proposal-20261111.sql` | Proposta explicitamente não instalada | Não atribuída | Cabeçalho explícito: PROPOSAL ONLY / NOT INSTALLED |
| `docs/sql/eut-ads-r2-private-foundation.sql` | Versão temática registrada | `20261110033818` — `eut_ads_r2_private_foundation_20261110` | Fundação de publicidade e versão R2 aplicada |
| `docs/sql/eut-ads-r3-admin-rpcs.sql` | Versão temática registrada | `20261110035800` — `eut_ads_r3_admin_crud_private_assets_20261110` | RPCs de publicidade e versão R3 aplicada |
| `docs/sql/eut-ads-r4-approved-public-cards.sql` | Versão temática registrada | `20261110040944` — `eut_ads_r4_approved_public_cards_20261110` | Entrega pública de cards e versão R4 aplicada |
| `docs/sql/eut-choose-new-role-without-wp-rule.sql` | Versão temática registrada | `20261110184534` — `eut_native_role_choice_not_wp_historical_rule_20261110` | Escolha de papel independente do WP; versão temática |
| `docs/sql/eut-contact-purchase-preparation.sql` | Instalação declarada no próprio arquivo | Não atribuída | Cabeçalho declara instalado no banco; sem versão de nome inequívoco |
| `docs/sql/eut-direct-flow-readiness-readonly.sql` | Consulta de leitura | Não atribuída | Arquivo com SELECT de contagens e metadados de políticas |
| `docs/sql/eut-legacy-claims-real-profiles-guard-20261110.sql` | Versão temática registrada | `20261110045442` — `eut_legacy_claims_real_profiles_guard_20261110` | Contrato de reivindicação de perfis e versão temática |
| `docs/sql/eut-member-invite-actor-lock-20261111.sql` | Versão temática registrada | `20261111154543` — `eut_member_invite_actor_lock_20261111` | Bloqueio de ator em convite e versão temática |
| `docs/sql/eut-operational-readiness-readonly.sql` | Consulta de leitura | Não atribuída | SELECT de observabilidade sem DDL |
| `docs/sql/eut-pioneer-verified-claim-and-bronze.sql` | Versão temática registrada | `20261110182437` — `eut_pioneers_secure_verified_claim_bronze_20261110` | Reivindicação verificada/pioneiros e versão temática |
| `docs/sql/eut-pioneers-native-pre-registry.sql` | Versão temática registrada | `20261110181617` — `eut_pioneers_native_pre_registration_20261110` | Pré-cadastro nativo e versão temática |
| `docs/sql/eut-project-owner-bootstrap.sql` | Versão temática registrada | `20261110025905` — `eut_project_owner_bootstrap_20261109` | Bootstrap de proprietário e versão temática |
| `docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql` | Contrato histórico com versão registrada | `20261112003518` — `eut_public_eligibility_guarded_ssr_20261112` | Apesar do nome proposal, cabeçalho diz HISTORICAL SQL CONTRACT, versão já aplicada; não é script de replay |
| `docs/sql/eut-public-referral-highlights-20261110.sql` | DDL sem proveniência conclusiva | Não atribuída | DDL de destaques de indicação, sem correspondência inequívoca |
| `docs/sql/eut-technician-public-slugs-20261110.sql` | DDL sem proveniência conclusiva | Não atribuída | DDL de slug público, sem correspondência inequívoca |
| `docs/sql/eut-verified-city-coverage-avatars-20261110.sql` | DDL sem proveniência conclusiva | Não atribuída | DDL de cobertura/avatares; dependência de catálogo, sem versão de conteúdo confirmada |
| `docs/sql/eut-wordpress-parity-readonly.sql` | Consulta de leitura | Não atribuída | SELECT de métricas sanitizadas de paridade WP |
| `docs/sql/tests/eut-admin-crud-ephemeral-assertions-20261111.sql` | Teste/ambiente isolado | Não atribuída | Asserções para PostgreSQL descartável; exige schema de testes |
| `docs/sql/tests/eut-admin-crud-ephemeral-schema-20261111.sql` | Teste/ambiente isolado | Não atribuída | Cria papéis e schema sintéticos SOMENTE em PostgreSQL descartável |
| `docs/sql/tests/eut-ads-r2-verify.sql` | Teste/ambiente isolado | Não atribuída | DO com verificação de esquema sem gravar, conforme inspeção estática |
| `docs/sql/tests/eut-ads-r3-rollback-tests.sql` | Teste/ambiente isolado | Não atribuída | Teste transacional com ROLLBACK |
| `docs/sql/tests/eut-ads-r4-rollback-delivery.sql` | Teste/ambiente isolado | Não atribuída | Teste transacional com ROLLBACK |
| `docs/sql/tests/eut-legacy-claims-real-profiles-rollback.sql` | Teste/ambiente isolado | Não atribuída | Teste transacional com ROLLBACK |

**Totais exatos:** 6 × DDL sem proveniência conclusiva; 12 × Versão temática registrada; 1 × Proposta explicitamente não instalada; 1 × Instalação declarada no próprio arquivo; 3 × Consulta de leitura; 1 × Contrato histórico com versão registrada; 6 × Teste/ambiente isolado. Total **30** (24 scripts de referência + 6 testes).

**Alerta sobre nomenclatura:** `eut-public-eligibility-moderation-proposal-20261111.sql` tem `proposal` no nome, mas seu cabeçalho afirma que a migration `eut_public_eligibility_guarded_ssr_20261112` já foi aplicada. O registro de versão `20261112003518` existe no Supabase; a origem ou identidade exata do SQL ainda não foi provada. **Não reaplicar** o script.

**Outro alerta:** `eut-admin-client-insights-20261111.sql` descreve indicadores administrativos *de leitura*, mas contém `CREATE OR REPLACE FUNCTION`, `GRANT` e `REVOKE`. Não é um script de consulta que se possa executar na produção sem mudar objetos do banco. Da mesma forma, os scripts de testes com `ROLLBACK` não são migrações de produção e os testes de PostgreSQL descartável criam papéis/tabelas sintéticos.

### 2.3 Evidências adicionais para versões ausentes do diretório executável

1. **Carga WordPress privada:** a [PR #5](https://github.com/hrq16000-a11y/encontreumtecnico/pull/5) documenta a importação ao esquema `eut_migration` e afirma explicitamente que **o SQL de origem não foi versionado**, o que explica parte da lacuna documental. O registro de versão `20261109012246` (`eut_private_wordpress_staging_20261108`) existe no Supabase. A PR documenta resultados e contém verificador somente leitura, mas **não constitui recuperação do corpo original**.
2. **Publicidade R5:** `20261110042554` (`eut_ads_r5_approved_image_delivery_20261110`) aparece aplicado no registro do Supabase. Existe um arquivo de SQL candidato **fora da main**, na branch da [PR #81](https://github.com/hrq16000-a11y/encontreumtecnico/pull/81), caminho `docs/sql/eut-ads-r5-approved-image-delivery.sql`, Git Blob `0e14340771e117e9474dbe28e4bb7b655cd0ae26` (315 linhas). O checklist da PR ainda deixa **[ ] migração no Supabase certo**, indicando descompasso entre documentação e registro atual. A migração pode ter sido aplicada por outro fluxo ou em outra revisão: **não é possível concluir que esse blob foi o executado**. Não mesclar/reaplicar.
3. **Convites de proprietário:** a [PR #142](https://github.com/hrq16000-a11y/encontreumtecnico/pull/142) mantém `docs/sql/eut-owner-admin-invitations-20261111.sql` em preparação isolada, com cabeçalho `PREPARATION ONLY`; não confundir com `eut_admin_member_invitations_20261111` do histórico aplicado.
4. **Hook de recadastro e sessões:** SQLs das [PRs #139](https://github.com/hrq16000-a11y/encontreumtecnico/pull/139) e [#145](https://github.com/hrq16000-a11y/encontreumtecnico/pull/145) declaram explicitamente **não aplicar sem homologação**. A presença desses arquivos na branch não prova aplicação e **não justifica instalar ou apagar** nada.
5. **Outros casos:** os 12 scripts de `docs/sql/` com versão temática e o contrato histórico de elegibilidade oferecem **pistas para investigar fontes**, não equivalência de conteúdo. Os seis arquivos DDL sem proveniência conclusiva permanecem nessa classe.

**Resultado da busca:** ainda existem **60 versões sem arquivo executável versionado** em `supabase/migrations/`. Foram localizadas referências e fontes candidatas para parte dessas versões, inclusive uma branch de PR e relatos de aplicação não versionada. **Nenhuma das 60 teve o corpo original autenticado** pelo registro de migrações; não inventar ou reconstruir SQL apenas a partir de nomes, comentários ou estado de objetos.

### 2.4 Reconciliação de PRs, garantias e sequência de aceite

- **Estado histórico do levantamento:** as propostas #4, #5, #26, #66 e #74 ainda estavam abertas quando a lista original foi preparada. Na reconciliação posterior de 12/11, essas cinco PRs foram **encerradas sem merge direto**, com evidências e fontes preservadas: #66 teve ferramentas offline portadas pela PR #227 (merge `c5611ecf`), enquanto seu SQL e restore ficaram na Issue #230; identidade/avatares da #74 na Issue #231; inventários e scripts #4/#5 na Issue #232. A #26 foi encerrada em rodada paralela; não declarar paridade total apenas por seu fechamento. As propostas #81, #133, #139, #142, #145, #146, #156, #200, #207 e #208 permanecem separadas e não são autorizadas para merge por este inventário. Nenhuma branch histórica foi apagada nesta reconciliação.
- Para retomar a reconciliação histórica, procurar exports ou logs de aplicação com conteúdo e procedência verificáveis em uma origem privada autorizada, **sem copiar dados pessoais ao Git**. Onde não houver fonte, registrar `corpo original não recuperado`.
- Antes de considerar completa a Issue #226, obter comparação de SQL de origem **com verificação de integridade**, revisar dependências de migrations em ambiente de teste descartável e separar **documentação de origem** de **migrações executáveis**.
- **Zero SQL executado; zero leitura de linhas de usuários, contas ou contatos; zero alterações em Supabase, DNS, Lovable, WordPress, Vercel, produção, backups ou arquivos executáveis.** Este registro exige revisão de procedência antes de recuperar qualquer corpo SQL e não autoriza aplicação de migrations.

**Estado desta rodada:** avanço na rastreabilidade e classificação, **sem declarar sincronização histórica completa**.

### Conferência de metadados e estado de PRs na revisão de 12/11/2026

- Recontagem independente com a API de migrations e a árvore Git em `c5611ecf599d738ffdf6f3e15eec616654864181`: **66 versões únicas**, **6 arquivos em `supabase/migrations/`** com prefixos coincidentes, **60 sem arquivo versionado correspondente**, **30 scripts `docs/sql/`**. Os 66 pares `versão + nome` desta tabela conferem com o histórico lido; **não foram comparados hashes/corpos SQL**.
- A lista de PRs acima representa o instante da auditoria inicial e foi atualizada para refletir o encerramento seguro de #4, #5, #26, #66 e #74. As fontes históricas permanecem nas refs dos respectivos PRs e nos comentários/Issues #230, #231 e #232.
- O inventário continua **somente metadados e documentação**: nenhum SQL instalado, migração reenviada, dado pessoal acessado, DNS alterado ou release solicitada.

---

> **Adendo independente à PR #229, que foi mesclada em paralelo:** esta seção foi reconstruída a partir do commit documental isolado `68ee8e068ff0923acffc926029ec707a1588d9e2`; não estava no merge da PR #229 (`09b17fde85a59f4d4a02cec1f040736d8f3db9fd`). A PR sucessora não requer deploy nem alterações no banco.

## Rodada 3 — procedência dos contratos e registros históricos de aplicação (12/11/2026)

Esta seção **atualiza os estados das PRs e a cadeia de procedência** nas rodadas anteriores. **Referência temporal:** na última consulta de metadados documentada na rodada 2 foram observadas 66 versões registradas no Supabase, 6 arquivos em `supabase/migrations/` no Git e 60 versões sem arquivo correspondente. **Nenhuma consulta ao Supabase foi feita nesta rodada 3 ou nesta revisão documental.** Os documentos deste inventário não devem ser usados como scripts de reprodução.

### 3.1 PRs WordPress #4 e #5 — cadeia histórica preservada

1. A [PR #5](https://github.com/hrq16000-a11y/encontreumtecnico/pull/5), HEAD `b7194b4556f89c2983f7b962431696df1585a66e`, foi **encerrada sem merge em 12/11/2026 às 04:47:50 UTC**. O histórico da PR e seus dois arquivos permanecem no commit da branch: `docs/WORDPRESS_STAGING_VALIDADO_2026-11-08.md` (Git blob `da778f62164f2793275a1db2cfc26b66a0d3fca1`) e `scripts/verificar_staging_wordpress.sql` (Git blob `c508bb12121dc647a4941f561e9673c33200219e`).
2. O documento original **declara**, mas esta auditoria não verificou os bytes do dump, uma extração MariaDB/phpMyAdmin em 08/11/2026 às 20h01 e um SHA-256 de origem `675126ddf6b5c2bee385b516aa597073795a69300d0331939c7ec4292eba3aa3`. O dump bruto tem informação privada e **não foi versionado**. O SHA-256 é um marcador de procedência **declarado**, **não um hash revalidado nesta rodada**; não baixar/abrir o dump nem inserir dados do dump no Git.
3. O histórico de `20261109012246` (`eut_private_wordpress_staging_20261108`) consta aplicado no Supabase; a descrição da PR e seu verificador histórico **não reconstituem** a migração original. Contagens descritas no documento de 08/11 são **fotografia histórica, não números atuais**.
4. A [PR #4](https://github.com/hrq16000-a11y/encontreumtecnico/pull/4), HEAD `0eeabc0d8f45b7350b7d7f12ce93d10df2b16b92`, também foi **encerrada sem merge em 12/11/2026 às 04:47:48 UTC**. A [Issue #232](https://github.com/hrq16000-a11y/encontreumtecnico/issues/232) preserva explicitamente as fontes de ambas, documenta a mudança de cenário (13 tabelas privadas de `eut_migration` em consulta anterior) e aponta verificadores de integridade mais recentes da PR #227. **Nenhum código nem documento antigo foi apagado ou fundido aqui.**
5. Portanto, as menções anteriores a `#4/#5` como PRs **abertas** estão desatualizadas. A decisão histórica foi preservação por fechamento **sem merge**, não incorporação automática ao diretório executável de migrations. A Issue #232 cuida da revisão privada de origem/backup, independente da Issue #226.

### 3.2 PR #81 — R5 de publicidade: evidência da aplicação vs. checklist inicial

- [PR #81](https://github.com/hrq16000-a11y/encontreumtecnico/pull/81) segue **aberta como Draft, sem merge**, HEAD `06cc779c331ef497d28c063855a3b9e539478ead`. Seu arquivo `docs/sql/eut-ads-r5-approved-image-delivery.sql`, Git blob `0e14340771e117e9474dbe28e4bb7b655cd0ae26`, tem 315 linhas pela leitura do conector. O histórico do caminho aponta commits `261587cc61f66cd966d80ef38d987c06a22e402e` e `4b2718f2b4a6100ee304ca0fe4f2b0ee4f446c60`.
- O comentário do autor na [PR #81](https://github.com/hrq16000-a11y/encontreumtecnico/pull/81#issuecomment-6759002495) em 10/11 registra aplicação do SQL e passagem de testes reais R4/R5 com rollback. A [Issue #72, relatório R5](https://github.com/hrq16000-a11y/encontreumtecnico/issues/72#issuecomment-6759002048) confirma no texto a versão `eut_ads_r5_approved_image_delivery_20261110` como aplicada no projeto dedicado e testes R5/R4, com zero anunciantes de teste persistidos.
- A consulta de metadados documentada na rodada 2 continha `20261110042554` para essa versão. Há **concordância entre um registro de versão e relatos contemporâneos de aplicação/testes**, mas nenhum deles fornece o SQL efetivamente executado ou seu digest.
- A checklist inicial da PR, entretanto, **não foi atualizada** e ainda marca aplicação no Supabase como pendente. Classificar como **checklist defasado frente ao registro e aos comentários**, e não como evidência de que a migration não foi executada.
- O SQL do blob Git **não foi comparado com um corpo SQL executado autenticado**: a consulta `list_migrations` expõe versão/nome, mas não fornece o texto original nem digest do corpo aplicado. Sem fonte autenticada, não declarar identidade exata, **não reaplicar**, não integrar R5 nem ativar imagens no site. A Issue #72 documenta que o Preview foi bloqueado por limite HTTP 402, motivo legítimo para manter a PR sem merge.

### 3.3 Procedência Git auditada dos 12 contratos correlatos

Para cada contrato foi consultado o **histórico do caminho no GitHub** e a associação **commit → PR** pelo endpoint público de commits. As **12 versões de tema correspondente** constavam da consulta `list_migrations` documentada na rodada 2. As PRs indicadas estão **mescladas**, mas a mera inclusão do arquivo **não prova execução ou igualdade de conteúdo no banco**.

| Versão aplicada por metadado | PR de integração | Commit com o arquivo | Contrato versionado | Situação documental de aplicação/teste |
|---|---|---|---|---|
| `20261110033818` | [#73](https://github.com/hrq16000-a11y/encontreumtecnico/pull/73) | [`7b7db8bdb0b5`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/7b7db8bdb0b55c0cf7daf99c04271796f0e77ac2) | `docs/sql/eut-ads-r2-private-foundation.sql` | Aplicação e teste RLS declarados no histórico da Issue #72 |
| `20261110035800` | [#76](https://github.com/hrq16000-a11y/encontreumtecnico/pull/76) | [`72181de6b88d`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/72181de6b88d3d3ca28c21045ba6c68f3cd2d435) | `docs/sql/eut-ads-r3-admin-rpcs.sql` | Aplicação e testes com rollback declarados na Issue #72 |
| `20261110040944` | [#78](https://github.com/hrq16000-a11y/encontreumtecnico/pull/78) | [`95ab422dd82b`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/95ab422dd82bbf9dccb5cbc4b8b6025b72ed4143) | `docs/sql/eut-ads-r4-approved-public-cards.sql` | Aplicação e teste com rollback declarados na Issue #72 |
| `20261111163136` | [#183](https://github.com/hrq16000-a11y/encontreumtecnico/pull/183) | [`9d40cdb7a7bc`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/9d40cdb7a7bc523a62f3dd839aab272006a46307) | `docs/sql/eut-admin-client-insights-20261111.sql` | PR relata compilação em transação rollback; não prova identidade do SQL aplicado |
| `20261111081500` | [#173](https://github.com/hrq16000-a11y/encontreumtecnico/pull/173) | [`608ed2c196c4`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/608ed2c196c40ee53dbaa42e9423a9a3dfaf17b7) | `docs/sql/eut-admin-member-invitations-20261111.sql` | Checklist de gates na PR antigo; versão aplicada registrada no Supabase |
| `20261111075718` | [#167](https://github.com/hrq16000-a11y/encontreumtecnico/pull/167) | [`c331490a2f31`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/c331490a2f316a9a28f7b97f1841362a7b65ad87) | `docs/sql/eut-admin-self-technician-role-20261111.sql` | PR descrevia SQL como não aplicado; versão observada em consulta posterior, sem data de execução nem hash |
| `20261110184534` | [#104](https://github.com/hrq16000-a11y/encontreumtecnico/pull/104) | [`b834b297bca6`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/b834b297bca6a9a130dcb44fc801a6c3e3308fbe) | `docs/sql/eut-choose-new-role-without-wp-rule.sql` | Versão correspondente por tema e PR integrada; SQL aplicado não autenticado |
| `20261110045442` | [#87](https://github.com/hrq16000-a11y/encontreumtecnico/pull/87) | [`e9d0b8268bb9`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/e9d0b8268bb93baa93bd50cfed9576944a9206c6) | `docs/sql/eut-legacy-claims-real-profiles-guard-20261110.sql` | PR integrada; testes de segurança previstos; SQL aplicado não autenticado |
| `20261111154543` | [#178](https://github.com/hrq16000-a11y/encontreumtecnico/pull/178) | [`517a29e8f81e`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/517a29e8f81e0a6021fe8d088cf99f3b37f3fb68) | `docs/sql/eut-member-invite-actor-lock-20261111.sql` | PR relata teste transacional rollback; SQL aplicado não autenticado |
| `20261110182437` | [#103](https://github.com/hrq16000-a11y/encontreumtecnico/pull/103) | [`8c67e626f7a4`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/8c67e626f7a4fadbae713577fdb42d919c1ffb80) | `docs/sql/eut-pioneer-verified-claim-and-bronze.sql` | Arquivo teve dois commits; commit final na mesma PR #103 |
| `20261110181617` | [#103](https://github.com/hrq16000-a11y/encontreumtecnico/pull/103) | [`7e5bfd77038c`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/7e5bfd77038cd55b0f928335b26412c6db505729) | `docs/sql/eut-pioneers-native-pre-registry.sql` | PR #103 incorporou contrato de pré-cadastro nativo |
| `20261110025905` | [#67](https://github.com/hrq16000-a11y/encontreumtecnico/pull/67) | [`bb4a19c5de6e`](https://github.com/hrq16000-a11y/encontreumtecnico/commit/bb4a19c5de6e0a58fca25333ba82939fbe5c9405) | `docs/sql/eut-project-owner-bootstrap.sql` | PR #67 integrada, mas checklist original de aplicação não é prova de execução |

**Força das evidências, sem confundir objetos**:
- **Banco:** registro de versão/nome na API `list_migrations` — confirma registro de aplicação, não integridade do corpo de SQL.
- **Código:** commit, caminho, Git Blob e PR mesclada — confirmam a cadeia histórica do arquivo no Git, não implementação exata no servidor.
- **Execução:** comentário de relator na [Issue #72 para R2](https://github.com/hrq16000-a11y/encontreumtecnico/issues/72#issuecomment-6758302278), [R3](https://github.com/hrq16000-a11y/encontreumtecnico/issues/72#issuecomment-6758602243) e [R4](https://github.com/hrq16000-a11y/encontreumtecnico/issues/72#issuecomment-6758798722) descreve aplicação e testes com rollback. São **relatos de execução**, não logs assinados, hashes de SQL ou teste reexecutado nesta auditoria.
- **Divergências temporais dos documentos:** a [PR #167](https://github.com/hrq16000-a11y/encontreumtecnico/pull/167) descrevia o SQL de autohabilitação como **preparado/não aplicado naquela entrega**, enquanto a consulta de metadados registrada depois inclui a versão `20261111075718`. Isso **não informa a data real de execução** da migration. A [PR #173](https://github.com/hrq16000-a11y/encontreumtecnico/pull/173) também mantém gates pendentes no texto original, embora a consulta posterior liste `20261111081500`. Nenhuma dessas fontes comprova **quando** ou **qual revisão do SQL** foi aplicada.

### 3.4 Conclusões válidas desta rodada e próximos gates

- Foram identificados **12/12 vínculos código→commit→PR** para os contratos correlatos, e fontes documentais adicionais para aplicação das fases R2–R5 de publicidade.
- A PR #5, embora fechada, preserva um **marcador SHA-256 declarado** de um dump privado e sua documentação sem os dados. A PR #81 contém um **arquivo SQL candidato único** ainda fora da main. Nenhum dos dois permite reconstruir integralmente as 60 definições SQL originais.
- **Número de arquivos originais autenticados entre as 60 lacunas:** **0**. Evidência documental é **um passo de rastreabilidade**, não recuperação técnica do corpo original.
- Próxima prova necessária: export autorizado de corpo/digest de versão da fonte privada original (quando disponível) com verificação de integridade, sem contato/dados/segredos e sem publicar dump; só após isso classificar **cópia idêntica**, **parcialmente correlata** ou **ausente**.
- **PR #229 está mesclada** no commit `09b17fde85a59f4d4a02cec1f040736d8f3db9fd`. Este adendo da **PR #235** é apenas documentação; não executa SQL, não altera migrações, contas, contatos, backups, produção, DNS, Supabase, Lovable ou WordPress. O merge operacional separado da #234 ocorreu em fluxo paralelo e **não é consequência deste inventário**. Nenhum deploy deve ser disparado pelo merge documental.

**Aviso de segurança da auditoria:** este inventário **não autoriza replay** de migrations, aplicação de SQL, restauração ou mudanças no esquema. Correspondência por nome, commit ou registro de versão não equivale à comprovação do conteúdo executado.

**Correção de status histórica:** qualquer tabela anterior que liste #4 ou #5 como `open` é snapshot da consulta anterior; prevalece nesta rodada `closed/merged=false`, com fontes preservadas em #232.


**Verificação independente do adendo em 12/11/2026:** os 12 commits Git citados na seção 3.3 contêm, cada um, o arquivo contratual declarado, e as respectivas PRs históricas estão mescladas. As 12 versões aparecem no registro de 66 migrations do Supabase dedicado, consultado sem alteração de dados. Essa prova de cadeia Git **não compara** SQL com o texto originalmente executado nem autoriza replay. A #234 teve merge operacional separado em `99e2a14d274b91c20d52d8b066480a488a18f6a0`; a #235 continua estritamente documental.

---

## Rodada 4 — proveniência das 60 migrations sem arquivo na main (12/11/2026)

**Escopo exclusivamente GitHub/arquivos/Issues.** Esta rodada NÃO consultou o Supabase nem alterou seu banco. A linha de base são os **66 pares versão/nome** documentados nas rodadas anteriores (consulta de metadados), confrontados com os **6 arquivos** de `supabase/migrations/` na main `72a7c9d597c9331528c063f492789e3e26333bfb`. A divergência nominal continua em **60 arquivos históricos ausentes da main**; isso não é uma falha de aplicação no banco.

**Duas verificações diferentes — nunca confundí-las:**

- **Procedência Git comprovada:** um arquivo correspondente existe em um commit/branch/PR do GitHub, com Git Blob hash verificável. **Não equivale** a comprovar o hash do SQL realmente executado no Supabase.
- **Corpo aplicado autenticado:** exige evidência independente do texto/digest do SQL aplicado no banco. **0 das 60 versões** satisfazem este nível nesta rodada; o corpo executado permanece não autenticado, inclusive nas quatro com arquivo original recuperado no Git.

### 4.1 Tipos de fonte identificada — categorias exclusivas

| Código | O que se comprovou | Versões |
|---|---|---:|
| **G** | Arquivo com versão exata sob `supabase/migrations/` preservado em **PR histórica**, mas ausente da main | **4** |
| **C** | Contrato ou referência SQL em arquivo Git (main ou PR), com correlação documental/nominal à versão; conteúdo aplicado **não comparado** | **16** |
| **D** | Documento/relato histórico associado à versão, **sem recuperar o corpo SQL original** | **2** |
| **N** | Nenhuma fonte específica de SQL ou documento de procedência encontrada nas referências examinadas, **além do nome/versão aplicado** | **38** |
| **Total** | Classificação documental (não prova de equivalência de esquema) | **60** |

**Fonte primária histórica recuperada (G):** a [PR #122](https://github.com/hrq16000-a11y/encontreumtecnico/pull/122) está fechada **sem merge** e preserva quatro arquivos `.sql` sob `supabase/migrations/`, com prefixos coincidentes às quatro versões registradas. Hashes Git Blob SHA-1 conferidos diretamente no HEAD histórico `5870562566b2c85324d24ba2684b3e97aad3c0a6`:

| Versão | Nome de migration | Git Blob SHA-1 do arquivo original histórico |
|---|---|---|
| `20261110220247` | `eut_private_moderation_guards` | `62515749cd80007924901aa4fba8d02220155d16` |
| `20261110221557` | `eut_admin_contacts_center_v1` | `44cb8dc45d948248b5e150bb0f4bec2d33a71ba8` |
| `20261110221912` | `eut_admin_contacts_audit_actor_v2` | `16e42421cebdc30978eb6ee9b8b43dc8991d2763` |
| `20261110222144` | `eut_moderation_allow_private_contact_disable` | `5998acfed2ea2b2c3b7898572c58c46690f95d89` |

O arquivo da versão `20261110220247` também consta na [PR #121](https://github.com/hrq16000-a11y/encontreumtecnico/pull/121), com **o mesmo hash Git Blob**; a [PR #221](https://github.com/hrq16000-a11y/encontreumtecnico/pull/221) o arquivou em `docs/admin/EUT_PRIVATE_MODERATION_MIGRATION_HISTORY_2026-11-12.md`. A comparação de texto do arquivo da #121 com o bloco SQL da cópia histórica foi **exatamente igual** após normalização de quebras de linha/espaços finais. Esses fatos comprovam **correspondência entre cópias Git**, não com o banco. **Não copiar nenhum desses quatro arquivos para as migrations ativas sem processo independente de revisão.**

**Fontes candidatas relevantes (C):** além dos 12 contratos `docs/sql/` já relacionados a commits/PRs na rodada 3, há SQL de **pedidos diretos** [PR #61](https://github.com/hrq16000-a11y/encontreumtecnico/pull/61), **respostas privadas** [PR #65](https://github.com/hrq16000-a11y/encontreumtecnico/pull/65), **R5 de mídia publicitária** [PR #81](https://github.com/hrq16000-a11y/encontreumtecnico/pull/81) e **elegibilidade pública** [arquivo de referência](https://github.com/hrq16000-a11y/encontreumtecnico/blob/72a7c9d597c9331528c063f492789e3e26333bfb/docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql). O fato de haver scripts/contratos Git e relatos de aplicação não valida a sua equivalência exata com o corpo aplicado.

**Documento sem corpo (D):** WordPress/staging [PR #5](https://github.com/hrq16000-a11y/encontreumtecnico/pull/5), com dump original mantido fora do Git por privacidade e hash apenas declarado; integração de reivindicação R3 `docs/INTEGRACAO_LEGADO_R3_20261109.md`, que declara instalação e não fornece SQL original. Não deduzir DDL de esquema a partir desses relatos.

### 4.2 Matriz completa, uma linha para cada versão sem arquivo na main

Todas as linhas têm a mesma condição técnica: **corpo executado no Supabase não autenticado por comparação de conteúdo/hash**. Os rótulos G/C/D/N descrevem apenas o nível de fonte **Git/documental** observado.

| Versão aplicada conforme inventário anterior | Nome registrado | Classe | Fonte / referência | Evidência disponível e limite |
|---|---|:---:|---|---|
| `20261109012246` | `eut_private_wordpress_staging_20261108` | D | [PR #5](https://github.com/hrq16000-a11y/encontreumtecnico/pull/5) | relato de staging WordPress; dump privado não versionado, SHA-256 apenas declarado; Issue #232 |
| `20261109014808` | `eut_admin_legacy_review_index_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109040240` | `eut_verified_legacy_claims_and_review_r3_20261109` | D | [Git main](https://github.com/hrq16000-a11y/encontreumtecnico/blob/72a7c9d597c9331528c063f492789e3e26333bfb/docs/INTEGRACAO_LEGADO_R3_20261109.md) | relato da integração de reivindicação legado R3, sem corpo SQL original |
| `20261109041716` | `eut_r4_google_only_admin_claim_safety_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109041753` | `eut_r4_google_claim_policy_jwt_access_fix_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109041918` | `eut_r4_google_only_account_types_and_owner_email_proof_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109042318` | `eut_r4_fix_recursive_rls_claim_quota_trigger_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109043730` | `eut_r5_wordpress_locality_quality_non_destructive_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109043939` | `eut_r5_restore_wordpress_sector_taxonomies_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109050359` | `eut_r5_no_country_as_city_before_public_approval_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109050547` | `eut_r5_private_ddd_aggregate_no_personal_contacts_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109051143` | `eut_r6_public_historical_archive_readonly_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109172951` | `eut_service_taxonomy_and_geography_admin_only_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109173053` | `eut_catalog_fix_anon_select_policy_separation_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109173153` | `eut_management_review_guardrails_and_editable_fields_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109174141` | `eut_claim_uses_confirmed_services_and_location_only_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109175135` | `eut_dynamic_filters_and_multiple_coverage_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109175657` | `eut_claim_copies_confirmed_uf_and_neighborhood_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109192140` | `eut_verified_email_password_role_choice_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109192241` | `eut_pending_claim_verified_password_tech_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109193711` | `eut_verified_email_private_legacy_lookup_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109200126` | `eut_stage_912_accounts_by_role_for_owner_activation_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109200317` | `eut_verified_legacy_account_activation_rpc_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109200358` | `eut_complete_legacy_claim_with_verified_password_identity_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109201057` | `eut_one_time_verified_wordpress_admin_bootstrap_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109201452` | `eut_safe_public_historical_wordpress_paths_v2_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109203155` | `eut_wordpress_specific_sector_evidence_review_only_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109203954` | `eut_private_media_bucket_and_transfer_queue_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109221030` | `eut_technician_specific_service_slugs_with_catalog_validation_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261109222732` | `eut_block_legacy_account_role_mismatch_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110000735` | `eut_real_candidate_avatar_evidence_from_nov09_xml_zip` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110002510` | `eut_atomic_self_service_legacy_role_account_and_professional_claim_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110003405` | `eut_self_published_complete_technician_profile_without_admin_review_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110010242` | `eut_optional_technician_presence_heartbeat_private_20261110` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110010442` | `eut_presence_batched_public_lookup_no_enumeration_20261110` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110011433` | `eut_opt_in_technician_referral_missions_no_fabricated_reward_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110013046` | `eut_secure_unpaid_requests_and_contact_quote_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110014712` | `eut_private_technician_whatsapp_and_paid_entitlement_read_20261109` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110023216` | `eut_opt_in_direct_technician_requests_20261109` | C | [PR #61](https://github.com/hrq16000-a11y/encontreumtecnico/pull/61) | SQL documental docs/EUT_PEDIDOS_DIRETOS_SQL_20261109.md (blob bb4cc0d2db6a) |
| `20261110024447` | `eut_direct_request_private_replies_20261109` | C | [PR #65](https://github.com/hrq16000-a11y/encontreumtecnico/pull/65) | SQL documental docs/sql/eut-direct-request-replies-20261109.md (blob a6614c7a63fa) |
| `20261110025905` | `eut_project_owner_bootstrap_20261109` | C | [PR #67](https://github.com/hrq16000-a11y/encontreumtecnico/pull/67) | contrato documental docs/sql/eut-project-owner-bootstrap.sql |
| `20261110033818` | `eut_ads_r2_private_foundation_20261110` | C | [PR #73](https://github.com/hrq16000-a11y/encontreumtecnico/pull/73) | contrato documental docs/sql/eut-ads-r2-private-foundation.sql |
| `20261110035800` | `eut_ads_r3_admin_crud_private_assets_20261110` | C | [PR #76](https://github.com/hrq16000-a11y/encontreumtecnico/pull/76) | contrato documental docs/sql/eut-ads-r3-admin-rpcs.sql |
| `20261110040944` | `eut_ads_r4_approved_public_cards_20261110` | C | [PR #78](https://github.com/hrq16000-a11y/encontreumtecnico/pull/78) | contrato documental docs/sql/eut-ads-r4-approved-public-cards.sql |
| `20261110042554` | `eut_ads_r5_approved_image_delivery_20261110` | C | [PR #81](https://github.com/hrq16000-a11y/encontreumtecnico/pull/81) | SQL R5 na branch Draft (blob 0e14340771e1); execução relatada na Issue #72 |
| `20261110045442` | `eut_legacy_claims_real_profiles_guard_20261110` | C | [PR #87](https://github.com/hrq16000-a11y/encontreumtecnico/pull/87) | contrato documental docs/sql/eut-legacy-claims-real-profiles-guard-20261110.sql |
| `20261110181617` | `eut_pioneers_native_pre_registration_20261110` | C | [PR #103](https://github.com/hrq16000-a11y/encontreumtecnico/pull/103) | contrato documental docs/sql/eut-pioneers-native-pre-registry.sql |
| `20261110182437` | `eut_pioneers_secure_verified_claim_bronze_20261110` | C | [PR #103](https://github.com/hrq16000-a11y/encontreumtecnico/pull/103) | contrato documental docs/sql/eut-pioneer-verified-claim-and-bronze.sql |
| `20261110184534` | `eut_native_role_choice_not_wp_historical_rule_20261110` | C | [PR #104](https://github.com/hrq16000-a11y/encontreumtecnico/pull/104) | contrato documental docs/sql/eut-choose-new-role-without-wp-rule.sql |
| `20261110184929` | `eut_pioneer_role_not_legacy_requirement_20261110` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261110220247` | `eut_private_moderation_guards` | G | [PR #122](https://github.com/hrq16000-a11y/encontreumtecnico/pull/122) | arquivo SQL em supabase/migrations/ na branch histórica, Git blob 62515749cd80 |
| `20261110221557` | `eut_admin_contacts_center_v1` | G | [PR #122](https://github.com/hrq16000-a11y/encontreumtecnico/pull/122) | arquivo SQL em supabase/migrations/ na branch histórica, Git blob 44cb8dc45d94 |
| `20261110221912` | `eut_admin_contacts_audit_actor_v2` | G | [PR #122](https://github.com/hrq16000-a11y/encontreumtecnico/pull/122) | arquivo SQL em supabase/migrations/ na branch histórica, Git blob 16e42421cebd |
| `20261110222144` | `eut_moderation_allow_private_contact_disable` | G | [PR #122](https://github.com/hrq16000-a11y/encontreumtecnico/pull/122) | arquivo SQL em supabase/migrations/ na branch histórica, Git blob 5998acfed2ea |
| `20261111065634` | `eut_protect_public_bio_contact_quarantine_20261111` | N | — | nenhum arquivo original ou contrato específico localizado nas fontes consultadas |
| `20261111075718` | `eut_admin_own_technician_role_20261111` | C | [PR #167](https://github.com/hrq16000-a11y/encontreumtecnico/pull/167) | contrato documental docs/sql/eut-admin-self-technician-role-20261111.sql |
| `20261111081500` | `eut_admin_member_invitations_20261111` | C | [PR #173](https://github.com/hrq16000-a11y/encontreumtecnico/pull/173) | contrato documental docs/sql/eut-admin-member-invitations-20261111.sql |
| `20261111154543` | `eut_member_invite_actor_lock_20261111` | C | [PR #178](https://github.com/hrq16000-a11y/encontreumtecnico/pull/178) | contrato documental docs/sql/eut-member-invite-actor-lock-20261111.sql |
| `20261111163136` | `eut_admin_client_insights_20261111` | C | [PR #183](https://github.com/hrq16000-a11y/encontreumtecnico/pull/183) | contrato documental docs/sql/eut-admin-client-insights-20261111.sql |
| `20261112003518` | `eut_public_eligibility_guarded_ssr_20261112` | C | [Git main](https://github.com/hrq16000-a11y/encontreumtecnico/blob/72a7c9d597c9331528c063f492789e3e26333bfb/docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql) | contrato histórico de elegibilidade, NÃO script reexecutável (blob 74ca757512d1) |

### 4.3 Escopo das buscas, lacunas e aceite

- Inspecionados histórico de PRs #121/#122/#221 (migrations arquivadas e recuperação sem replay), #61/#65 (documentos SQL), #81 (R5), #5/#232 (staging), os 12 contratos por commit/PR e documentos de integração. Foram consultadas pesquisas de PRs/issues por referências de SQL/migração. **Não significa que todos os backups, branches privadas externas e ferramentas administrativas possíveis tenham sido percorridos.**
- `N` significa **ausência de fonte localizada nesta amostra verificável**, não prova de inexistência em outros backups ou no serviço que aplicou o SQL.
- Antes de avançar, obter de fonte autorizada e não pública o digest/corpo efetivamente aplicado, sem divulgar PII, credenciais, dumps, anexos privados nem payloads de usuários. Quando irrecuperável, registrar `corpo original não recuperado`, **sem inventar DDL ou falsificar equivalência**.
- **Não autoriza replay**, execução de SQL, migração, alteração de banco, exclusão, merge, deploy, DNS, WordPress, Lovable ou modificações em produção. Este é apenas um adendo documental em branch isolada, sem dados pessoais ou SQL executável.

### 4.4 Revisão de hashes, consistência e privacidade (12/11/2026)

**Originais históricos G (4/4):** relidos os arquivos `supabase/migrations/` na HEAD `5870562566b2c85324d24ba2684b3e97aad3c0a6` da [PR #122](https://github.com/hrq16000-a11y/encontreumtecnico/pull/122); os quatro Git Blob SHA-1 conferem com os hashes expostos no diff original e na tabela 4.1. O fechamento da PR #122 foi **sem merge**. Os arquivos foram preservados na branch histórica, **não restaurados** na main.

**Limite particular da versão `20261110221912`:** o arquivo histórico de 11 linhas obtém a definição da função existente com `pg_get_functiondef(...)`, usa substituição textual e execução dinâmica. Seu efeito **depende da definição pré-existente no momento da aplicação**. Portanto, o arquivo é uma fonte primária do **script versionado no Git**, mas **não uma definição autocontida do objeto final no banco** e não permite reconstruí-lo por si só. Não executar ou reaplicar.

**Contratos C (16/16):** todos os caminhos da matriz 4.2 foram localizados no Git, lidos sem execução e conferidos por Git Blob SHA-1. As 12 associações da rodada 3 mantêm suas PRs de integração; #61 e #65 preservam SQL em documentos Markdown; #81 contém R5 em branch Draft; elegibilidade está documentada na main. A existência desses arquivos **não autentica o corpo SQL efetivamente aplicado**.

| Versão correlata | PR ou origem | Arquivo Git | Git Blob SHA-1 conferido | Limite documental |
|---|---|---|---|---|
| `20261110023216` | [#61](https://github.com/hrq16000-a11y/encontreumtecnico/pull/61) | `docs/EUT_PEDIDOS_DIRETOS_SQL_20261109.md` | `bb4cc0d2db6a6d3e70c6d90f984ccab3b998a88f` | Markdown com SQL de referência |
| `20261110024447` | [#65](https://github.com/hrq16000-a11y/encontreumtecnico/pull/65) | `docs/sql/eut-direct-request-replies-20261109.md` | `a6614c7a63fa46e1bdac802f1ed2c841db67b281` | Markdown com SQL de referência |
| `20261110025905` | [#67](https://github.com/hrq16000-a11y/encontreumtecnico/pull/67) | `docs/sql/eut-project-owner-bootstrap.sql` | `08e4a9c7d58c81864859377df7cf6ee78b4b17ae` | Contrato SQL |
| `20261110033818` | [#73](https://github.com/hrq16000-a11y/encontreumtecnico/pull/73) | `docs/sql/eut-ads-r2-private-foundation.sql` | `a972d40942ea0b25223ff9f4fe8b5d30ab1f9e5d` | Contrato SQL |
| `20261110035800` | [#76](https://github.com/hrq16000-a11y/encontreumtecnico/pull/76) | `docs/sql/eut-ads-r3-admin-rpcs.sql` | `480f61e97e68f349e1a0c56e066153687f4c27e5` | Contrato SQL |
| `20261110040944` | [#78](https://github.com/hrq16000-a11y/encontreumtecnico/pull/78) | `docs/sql/eut-ads-r4-approved-public-cards.sql` | `2203bcbdd4e23ee3c232758167ea31f4f65cf85e` | Contrato SQL |
| `20261110042554` | [#81](https://github.com/hrq16000-a11y/encontreumtecnico/pull/81) | `docs/sql/eut-ads-r5-approved-image-delivery.sql` | `0e14340771e117e9474dbe28e4bb7b655cd0ae26` | SQL na PR Draft, fora da main |
| `20261110045442` | [#87](https://github.com/hrq16000-a11y/encontreumtecnico/pull/87) | `docs/sql/eut-legacy-claims-real-profiles-guard-20261110.sql` | `a4a43e8503d79b1a831637b001252bb32b13d94d` | Contrato SQL |
| `20261110181617` | [#103](https://github.com/hrq16000-a11y/encontreumtecnico/pull/103) | `docs/sql/eut-pioneers-native-pre-registry.sql` | `74c0e6b95a1f6c17c86a20f71581e469090ee859` | Contrato SQL |
| `20261110182437` | [#103](https://github.com/hrq16000-a11y/encontreumtecnico/pull/103) | `docs/sql/eut-pioneer-verified-claim-and-bronze.sql` | `821c1d2305db84af9c8a22902b22661cd5c5c3ad` | Contrato SQL |
| `20261110184534` | [#104](https://github.com/hrq16000-a11y/encontreumtecnico/pull/104) | `docs/sql/eut-choose-new-role-without-wp-rule.sql` | `17ab742a9687f7e27bec3da468eda00756e217e7` | Contrato SQL |
| `20261111075718` | [#167](https://github.com/hrq16000-a11y/encontreumtecnico/pull/167) | `docs/sql/eut-admin-self-technician-role-20261111.sql` | `2f3e36a10e4e5b8e0b83d65f2c2781bf5ff651d9` | PR registra SQL preparado na integração |
| `20261111081500` | [#173](https://github.com/hrq16000-a11y/encontreumtecnico/pull/173) | `docs/sql/eut-admin-member-invitations-20261111.sql` | `baeaa1d17a4cadeb3dc120308243c21d3580deef` | Contrato SQL, gates históricos separados |
| `20261111154543` | [#178](https://github.com/hrq16000-a11y/encontreumtecnico/pull/178) | `docs/sql/eut-member-invite-actor-lock-20261111.sql` | `fd03e9f86efc558330c93c6a98bc0fc389c1a944` | Contrato SQL |
| `20261111163136` | [#183](https://github.com/hrq16000-a11y/encontreumtecnico/pull/183) | `docs/sql/eut-admin-client-insights-20261111.sql` | `c24c8c822d889d5d3b45f82f7d719b543571522d` | Contrato SQL |
| `20261112003518` | [main](https://github.com/hrq16000-a11y/encontreumtecnico) | `docs/sql/eut-public-eligibility-moderation-proposal-20261111.sql` | `74ca757512d12efd948cf7344c54b6e2965e4e76` | Contrato histórico; não reaplicar |

**Privacidade:** a revisão estática das 20 fontes (quatro arquivos históricos e 16 contratos candidatos) não encontrou padrões de e-mail pessoal, telefone brasileiro completo ou chave de serviço nas formas pesquisadas. Não é garantia de inexistência de todos os tipos de dados pessoais. O presente documento de inventário **não incorpora SQL, dump ou dados privados**: contém apenas metadados, caminhos, hashes e referências. Os dois documentos Markdown de origem contêm SQL, mas seu conteúdo não foi copiado para cá.

**Gates do adendo:** a matriz anterior permanece com 60 versões únicas, distribuídas G=4, C=16, D=2, N=38. Há 16/16 contratos localizados e 4/4 hashes históricos confirmados. **0/60 corpos efetivamente executados autenticados por digest do Supabase.** Esta evidência não autoriza replay, aplicação de SQL, merge, deploy, exclusões, DNS, WordPress, Lovable ou alterações de produção.
