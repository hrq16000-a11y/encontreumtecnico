# Encontre um Técnico — desligamento seguro da hospedagem WordPress

Última revisão: 10/11/2026. Documento de transição, **não certificado de conclusão**.

## O que já não exige o WordPress hospedado

- **Cadastro novo:** autenticação Google/e-mail via Supabase Auth, seleção de técnico/cliente pela RPC `choose_account_type`, confirmação de identidade e autorização no servidor. Quando a descoberta histórica falhar, a pessoa pode tentar um cadastro novo: a RPC ainda bloqueia identidade não confirmada, papel antigo divergente ou histórico vinculado a outra pessoa.
- **Perfil profissional:** publicação de nome, UF, cidade, especialidades e serviços ativos pela RPC `eut_publish_my_technician`. Nenhum status público é definido diretamente pelo browser.
- **Busca e solicitação:** consulta de técnicos ativos no Supabase; triagem, consentimento explícito, pedido e resposta privados sob RLS; números nunca publicados por importação de WordPress.
- **Diretório antigo:** 310 fichas públicas sanitizadas, dados e URLs antigas servidos pelo snapshot Supabase e pela aplicação TanStack; nenhuma chamada ao PHP, banco, API REST ou login da hospedagem WordPress é necessária.
- **Avatares:** a única imagem legada integrada ao código usa cópia independente Cloudinary por ID verificado, não URL do WordPress.
- **Canônicos SEO:** URLs `https://www.encontreumtecnico.com` continuam porque são o domínio oficial desejado, não uma dependência técnica de WordPress.

### Controle anti-regressão

`node scripts/eut-wordpress-runtime-boundary.mjs` examina o código-fonte TypeScript/TSX para padrões diretos de rede à hospedagem WordPress (REST, mídia, login, AJAX e chamadas fetch), cobra que a criação de papéis e publicação permaneçam no servidor e garante Vercel sem deploy por push. Rode junto com `technician-auth.yml`. É uma prova **estática**; tráfego de rede real, links de terceiros e bundles precisam de observação após release.

## O que não pode ser apagado ainda

| Item | Estado verificado |
| --- | --- |
| Contas históricas preservadas no Supabase | 913 |
| Técnicos WordPress aguardando identidade do titular | 404 |
| Clientes WordPress aguardando titular | 508 |
| Perfis históricos no diretório | 655 |
| Fichas de demonstração proibidas | 20 |
| URLs históricas em validação | 615 |
| Mídias legadas referenciadas | 434 |
| Técnicos ativos criados/publicados na plataforma nova | 0 |
| Pedidos reais na nova plataforma | 0 |

**Retirar o WordPress do ar não significa excluir o acervo importado.** As tabelas `eut_migration` e as funções de associação ainda são usadas pelo cadastro antigo e pelas validações de papéis. São dados **locais ao Supabase**, não uma chamada à hospedagem WordPress, mas só podem ser aposentados depois de migrar de modo verificável o controle de titularidade e os históricos para estruturas nativas definitivas.

## Sequência para cortar o último vínculo

1. Fechar as dependências operacionais de login, papel, perfil, triagem e contato na aplicação nova. Este PR resolve o travamento da escolha por indisponibilidade da **consulta opcional** do arquivo legado; não ignora as validações no servidor.
2. Congelar backup exportável e checksum dos XMLs, banco e ZIP de mídia, preservando informações privadas e direitos dos titulares. Não apagar nada do WordPress nem dos buckets antes de verificar cada cópia.
3. Reconstruir a cobertura histórica: validar as 615 rotas, mapear redirecionamentos legítimos, manter as 20 demos excluídas; associar e revisar fotos originais 1:1 sem inventar avatares.
4. Homologar primeiro técnico real e cliente real com duas identidades confirmadas, publicar técnico, procurar por UF/cidade/serviço, registrar e compartilhar pedido com opt-in, receber resposta e garantir sigilo de contato.
5. Fazer um Preview e um release Vercel **manuais e consolidados**, com gates, mesmo SHA, produção READY, HTTP 200/404 real, SEO e rollback; não consumir deployment por micro-commit.
6. **Somente depois** autorizar cutover DNS. Manter snapshot e backups históricos independentes por período de recuperação. Não desativar o WordPress antes de garantir restauração e redirecionamentos.

### GO/NO-GO (10/11/2026)

**NO-GO para alterar DNS ou desligar a hospedagem antiga.** A produção Vercel ainda executa SHA anterior à `main`. A ausência de técnicos e solicitações reais impede considerar o fluxo comercial equivalente, apesar de cadastro/busca já existirem no código. A aplicação nova pode continuar sendo desenvolvida sem usar o WordPress como backend ativo.
