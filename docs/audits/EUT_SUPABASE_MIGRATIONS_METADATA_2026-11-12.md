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
