# Paranaguá/PR — importação pública de referência, sem contas fictícias

Data: 11/11/2026. Fonte: https://guiafix.com.br/paranagua-pr/tecnico-de-informatica

## Aquisição e fidelidade

- Uma única abertura da página, sem paginação, sem abrir fichas individuais, sem contornar limites.
- O retorno foi uma **cópia indexada consultada há aproximadamente 5 meses**, portanto não comprova situação atual.
- A cópia textual exibe o contador **859** e 13 nomes completos em trecho editorial; o print fornecido pelo usuário exibe **878**.
- **Apenas 13 nomes** constam no arquivo de captura. Não anunciar 878/859 técnicos importados, ativos ou validados.
- Cidade validada na tabela oficial de municípios do projeto: **Paranaguá/PR — IBGE 4118204**.
- Fonte de dados: `data/external-staging/guiafix-paranagua-pr-tecnico-informatica.capture.json`, sem telefone, WhatsApp, email, redes, notas, foto, links de contato ou avaliações.

## Habilitação segura — proposta em branch, NÃO em produção

- Os 13 nomes são **referências públicas externas**, **não** perfis de técnicos cadastrados, aprovados, verificados ou disponíveis.
- A seção preparada está dentro de `/servicos/computadores` (não é guia paralelo, nem página SEO rasa).
- CTA utiliza **funil de ajuda regional** já existente (`openFreeHelp`), sem passar qualquer identificador de terceiro, sem acionar contatos privados, sem cobrança e sem atribuir pedido a profissional não reivindicado.
- Esses nomes não entram em `technicians`, `user_roles`, `legacy_review_profiles`, nem em sitemaps de perfis; nenhuma conta Supabase foi criada.
- Cadastro voluntário e confirmação da titularidade são necessários antes de converter uma referência em prestador do portal. Tratar pedidos de remoção/correção e termos/LGPD na revisão.
- Deduplicar contra cadastros existentes antes de ativação futura e preservar bloqueios/banimentos.

## Gates bloqueantes
- Executar `node --test scripts/external-directory-batch.test.mjs scripts/external-directory-snapshot.test.mjs scripts/external-directory-paranagua.test.mjs`.
- Validar SSR da categoria, a distinção entre técnicos cadastrados e referências, funil existente e inexistência de links para contatos de terceiros; validar mobile.
- PR stacked sobre a PR #200 em draft, sem merge em `main`, sem deploy, DNS, SQL mutável ou alterações reais.
- **Não reabrir a página GuiaFix para este par categoria/cidade**.
