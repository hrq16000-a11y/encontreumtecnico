# Encontre um Técnico — fusão WordPress → Supabase → GitHub/Lovable (09/11/2026)

## Fontes reconciliadas
- Backup SQL de origem `encontre_wp_aishs.sql`, já convertido e carregado no schema privado `eut_migration`.
- Novo WXR `encontreumtcnicoprecisodeumtcnico.WordPress.2026-11-09.xml`, exportado em 09/11/2026 01:38 UTC: contém 384 `candidate` e 17 anexos.
- Os **384 IDs e slugs** do WXR coincidem, por comparações independentes de MD5 ordenado, com os registros `candidate` do banco privado. O WXR **não é backup completo nem contém todos os 270 contratantes**.
- **20 perfis** são associados a usuários `cand-dummyN` e devem ser tratados como demonstração, sem publicação automática.

## Fusão técnica efetivamente aplicada no Supabase externo
- Fonte privada: `eut_migration.legacy_directory`, 384 técnicos + 270 contratantes. Nenhum telefone ou e-mail deve ser exposto ao cliente.
- Nova tabela administrativa de consulta: `public.legacy_review_profiles`, com 654 linhas, ID WordPress, tipo, nome, especialidade e localidades; **sem telefones, e-mails, senhas ou tokens**.
- RLS ativa; `anon` sem permissão SELECT; `authenticated` com SELECT **somente para usuário cujo UUID tenha papel administrativo em `public.user_roles`**. Todos os demais retornam zero linhas. INSERT/UPDATE/DELETE indisponíveis a clientes.
- Perfis permanecem `pending_review`, **nenhum status vira `aprovado` automaticamente**.
- A migração SQL foi aplicada ao Supabase externo pelo conector; não escrever em `supabase/migrations/` do Lovable conforme `AGENTS.md`.

## Interface do GitHub
- Componente `src/components/legacy-review-queue.tsx` consultará tabela nova com cliente Supabase existente.
- Renderizado **somente dentro da rota `/admin`** e apenas após papel `admin`; RLS autoriza a leitura no servidor.
- Filtros de técnicos/contratantes, busca textual, paginação de 24, sinalização de demos, sem contatos privados e sem botões de publicação.
- Conector Lovable usa a branch `main`: PRs de trabalho em branch isolada **não aparecem no editor até o merge**. Não reescrever o histórico e não editar arquivos gerados pelo Lovable.

## Verificações observadas
- Banco: 654 linhas (384/270), 20 demos, 654 `pending_review`.
- RLS: teste de papel `authenticated` sem administrador retornou **0 linhas**.
- GitHub/Vercel: Preview de branch compila; teste de login real/consultas com admin ainda pendente.
- `auth.users`: zero no momento da inspeção; não é correto marcar alguém admin apenas porque o email foi digitado num formulário.

## Próximos gates
1. Proprietário entra **uma vez com Google** no app novo (Lovable/Vercel homologação). Conferir diretamente no Supabase que a identidade pertence ao provedor `google` e que o email verificado coincide com o autorizado; só então registrar `user_roles.role='admin'` para o UUID confirmado.
2. Testar RLS com usuário administrador real e usuário comum, validando lista no painel sem vazamento; conferir URL de redirecionamento OAuth (Lovable Preview e Vercel).
3. Implementar mecanismo autenticado e auditado para vincular `legacy_accounts.wp_user_id` a `auth.users.id`; e-mail sozinho nunca deve autorizar tomada de conta.
4. Criar publicação controlada de perfis revisados, avatar/mídias e integração com `public.technicians`, preservando UUID de titular.
5. Homologar busca, solicitações, perfis, recuperação, mídia e SEO antes de discutir DNS. **Site WordPress original permanece intacto.**
