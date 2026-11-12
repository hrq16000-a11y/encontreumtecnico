# Release — suporte de login e cadastro (12/11/2026)

## Código previamente integrado
- Repositório: `hrq16000-a11y/encontreumtecnico`; Vercel oficial: `msolus/encontreumtecnico`.
- PR #219, HEAD validado: `a7a0e5f551a18bbfc96000b4ab439e455166774b`.
- Merge squash à `main`: `6a68932f4ab9561c58af8c84346d295ec4e7ccef`.
- Nove workflows do GitHub Actions com conclusão **SUCCESS** no HEAD original, incluindo gates de build, autenticação, Home2, SEO, mobile, admin e assistência guiada. CodeRabbit: **skipped**, não contabilizado entre os aprovados.

## Funcionalidade
- Página `/ajuda-acesso` acessível sem login e marcada `noindex,nofollow`.
- Links claros em `/entrar` e `/contato`.
- Reutilização de `ContactForm` e `contact_messages` existentes; o formulário não divulga dados de moderação nem telefones de técnicos.
- Orientação para não enviar senhas, códigos de acesso, documentos ou dados bancários.

## Publicação controlada
O comando Ignored Build Step na Vercel só processa commits com prefixo `release:` ou `[publish]`. O merge funcional com título `fix(suporte):` foi corretamente ignorado pelo deploy `dpl_sabo3Mr82ANUj7uqjqntqRLYP1hW` (CANCELED pelo filtro, **não** erro de compilação). Esta nota documenta a entrega e autoriza **um único build** do commit de release, sem alterar o filtro.

## Limites e salvaguardas
- Nenhuma migration, RPC, SQL, RLS, cadastro, contato privado, DNS, Supabase, WordPress, Lovable ou pagamento alterado.
- Não foram enviados formulários de teste com identidades reais. O aceite operacional de entrega de mensagens depende de validação consentida sem dados sensíveis.
- Verificar deployment READY, commit exato, HTTP da rota de ajuda, login/contato e `noindex` antes de declarar publicação concluída.
- PRs de migrations e importações públicas continuam isoladas até aprovação específica.