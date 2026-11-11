# EUT — pré-cadastro seguro de contas restritas (micro-rodada)

**Estado:** preparação em branch isolada. Não equivale a proteção ativada na plataforma.

## Contexto
A PR #138 aplica bloqueios operacionais para contas e telefones conhecidos, inclusive com sessão ativa. Isso não impede automaticamente que o Supabase Auth crie um usuário novo. O hook `Before User Created` pode negar **novas** identidades com e-mail vinculado a conta banida existente ou telefone completo presente na lista restrita. Google OAuth e e-mail são tratados pelo mesmo hook, quando a criação de usuário realmente ocorrer.

## Pré-requisitos e implantação controlada
1. Preservar backup e registrar estado atual do Auth; conferir que não há outro hook `Before User Created` para não substituir uma política existente.
2. Conferir que a lista de restrições é correta, inclusive contatos explicitamente desbloqueados. Não semear números falsos.
3. Revisar `docs/sql/eut-auth-before-user-created-guard-20261111.sql` e testar em ambiente isolado, com contas de teste, antes de aplicar a função ao banco oficial.
4. Rodar `docs/sql/eut-auth-hook-smoke-20261111.sql` em sessão controlada. O arquivo não altera tabelas nem dados reais.
5. Somente após homologação, entrar em **Supabase > Authentication > Hooks > Before User Created**, escolher **Postgres** e a função `eut_moderation.before_user_created_guard`. Habilitação requer aprovação separada, pois pode afetar novos cadastros.
6. Validar criação legítima por e-mail, Google e telefone; recusa de e-mail/telefone restrito; recuperação de senha de conta existente; login de contas válidas; fluxo de suporte. Conferir mensagens genéricas sem revelar motivo ou número bloqueado.
7. Plano de reversão: desabilitar o hook no painel **antes** de qualquer mudança na função. Preservar dados, logs e bloqueios já existentes.

## Limites
- O hook atua **somente na criação de usuários**, não encerra sessões nem impede login em uma conta já criada. Revogação de sessões e proteção das rotas administrativas são trabalho separado.
- Não prova que o mesmo indivíduo criou uma conta com **outro e-mail e outro telefone**. Não usar IP, geolocalização, DDD, nome ou `user_metadata` como substituto de prova de identidade.
- Não conflitar com a PR #133 (modal Google OAuth) nem alterar a configuração OAuth, DNS, produção, Lovable, WordPress, contatos privados ou as 20 demonstrações.
- O código é deliberadamente *fail-safe* para registros legítimos sem identificador suficiente: nesses casos o hook não confirma uma identidade banida e a moderação operacional continua valendo.
- Nenhum dado de lista de banidos é retornado pelo hook: apenas mensagem genérica orientando o suporte.

Referência oficial: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
