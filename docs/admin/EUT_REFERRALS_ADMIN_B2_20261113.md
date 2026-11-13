# Issue #262 — B2: contrato seguro para extrato administrativo de indicações e pontuação

**Estado:** contrato e fixtures sintéticas somente na branch de monetização. Não existe aqui RPC B2 criado, chamado ou instalado, não houve consulta nem alteração no Supabase hospedado. Não há pontuação monetária ou comissões reais homologadas. A1+B1 podem ser liberadas juntas após seus gates mínimos sem esperar o backend B2.

## Evidências do repositório e limites
- `src/components/technician-missions.tsx` usa `eut_my_referral_dashboard` para consultar somente a própria conta autenticada, com `code`, `invited_accounts`, `invited_public_profiles`, `profile_published` e `online_recent`. Não serve para buscar todas as contas no ADM.
- `src/routes/convite.$codigo.tsx` e `eut_accept_technician_invite` permitem vínculo voluntário de convite; não são consultas de relatório.
- `docs/sql/eut-public-referral-highlights-20261110.sql` referencia `public.eut_technician_referrals(inviter_user_id, invited_user_id)` e `public.technicians(user_id,id,status)`. O destaque retorna somente IDs públicos de técnicos aprovados com ao menos dois perfis indicados publicados. **Não** revela quais convidados, nem total de indicações por técnico.
- O inventário `docs/audits/EUT_SUPABASE_MIGRATIONS_METADATA_2026-11-12.md` registra 66 migrações aplicadas, mas só 6 arquivos locais correspondentes; não comprova schema completo/SQL hospedado do programa de indicações.
- `docs/sql/eut-admin-client-insights-20261111.sql` é **referência não validada de equivalência** para o padrão de guarda admin: `auth.uid()`, `public.has_role(...,'admin')`, `public.eut_account_operational()`, paginação, leitura agregada. Não constitui autorização para instalação/reaplicação.
- Tipos gerados em `src/integrations/supabase/types.ts` não descrevem atualmente tabela `eut_technician_referrals` ou RPC de extrato administrativo.

## Contrato B2 preparado (nenhum endpoint conectado)
`src/lib/admin-referral-ledger-contract.ts` define `parseAdminReferralLedgerPage(input: unknown)`. Recebe futuramente um envelope com `version: 1`, `as_of` UTC, `page`, `page_size`, `total` e `rows`. Cada linha contém exclusivamente `technician_id` público (não ID de Auth), `public_slug`, `display_name` e município/UF declarados, `invited_accounts`, `invited_public_profiles` e `points`.

O contrato rejeita:
- paginação acima de 25 itens; totais/contagens ausentes, negativos, fracionários ou inconsistentes; perfis publicados acima dos convites associados; IDs duplicados, campos inválidos ou extras;
- `user_id`, `invited_user_id`, `email`, `phone`, `referral_code`, `commission`, `balance` ou qualquer campo não permitido, inclusive no envelope;
- pontuação numérica solta sem evidência. `points: {status:"unavailable"}` é a única apresentação possível enquanto não houver regra de pontos e ledger real. Um futuro `points: {status:"verified",value,rule_version,ledger_revision,calculated_at}` requer comprovação **no servidor** — strings sintaticamente válidas não provam ledger.

**Nunca inferir pontos a partir da quantidade de convites.** Qualquer consulta falhada ou payload inválido deve aparecer como *Indisponível*, nunca zero. Dados de exemplo usados nos testes são inteiramente sintéticos.

## Bloqueios objetivos antes de habilitar extrato real
1. Confirmar em consulta read-only autorizada o schema efetivamente instalado, RPCs, unicidade/atribuição dos convites, RLS/grants e relação correta entre técnicos sem Auth e com Auth. Não fabricar proprietário para perfil sem autenticação.
2. Criar **separadamente e só após autorização** um RPC administrativo agregado, com verificação de identidade, papel `admin` no banco, conta operacional, restrições/bloqueios e paginação limitada. Não conceder SELECT direto sobre vínculos privados a `anon` ou `authenticated`.
3. Contar apenas convite aceito, atribuído uma vez, sem autoindicação ou duplicidade; perfis publicados elegíveis não podem exceder associações confirmadas. Não contar visitas, cliques ou leads como conversão.
4. Responder apenas campos públicos do indicador e **totais agregados**; nunca listar convidados, números de contato, e-mails, códigos de convite ou dados de pagamento.
5. Definir política oficial versionada de pontos, eventos auditáveis, critérios de reversão e conciliação. **Comissão financeira é outra frente**, exclusivamente após aquisição paga e confirmada de acesso ao contato, política aprovada e eventual estorno.

## Liberação e custo
O teste sintético do parser deve entrar na suíte administrativa existente, sem criar workflow ou PR novos. Há também verificação local da implementação pura em Node 22 e TypeScript 5.8.3; isso **não** substitui Vitest, RLS, QA autenticado ou validação do backend. Enquanto não houver RPC admin comprovadamente seguro, **não** chamar endpoint fictício nem mostrar extrato de pontos no painel; manter a prévia B1 separada, corretamente identificada como amostra de destaques públicos. A1+B1 poderão ser publicadas juntas, após os gates mínimos e QA pontual, sem prender a monetização à futura B2.

Preservar main, Supabase hospedado, SQL/RLS/dados, pagamentos, DNS, PRs #255/#256/#259 e o redesign de `/tecnicos`, incluindo barra inferior mobile e CTA flutuante "Preciso de ajuda".
