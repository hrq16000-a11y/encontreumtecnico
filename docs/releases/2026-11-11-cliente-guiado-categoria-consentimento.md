# Release — cadastro guiado do cliente e destinatário consistente
Data: 11/11/2026 (Brasil)
Escopo: Encontre um Técnico, produção Vercel `msolus/encontreumtecnico`.

## Conteúdo incluído
- PR #118: quatro passos para solicitação do cliente; salvamento privado e compartilhamento somente com autorização explícita.
- PR #124: selecionar, trocar ou remover o técnico dentro do passo 3, sem abandonar o rascunho.
- PR #154: rascunho salvo imediatamente e preservação do último caractere na navegação.
- PR #214: **corrigido** destinatário antigo após mudança de categoria: limpa UUID da sessão e do estado, revoga consentimento anterior, sem apagar os dados do pedido.
- Consolidação da `main` no commit `eaed1b7f950f6d8bc05a867a4e301ada6d760afe`, incluindo a release administrativa anterior (#209/#211/#212) com SQLs transacionais **apenas propostos**, não aplicados.

## Evidências verificadas antes do release
- PR #214, HEAD `9af2b5134c36170d6f8bccda789d7a1cfa1a6043`: **9 workflows de PR com jobs efetivamente executados e sucesso**, incluindo testes de privacidade, consentimento de solicitação direta, triagem, rascunhos, Vitest, build TanStack e TypeScript.
- Cinco workflows históricos com evento `push` continuam reportando `failure` **sem jobs**; não foram executados, portanto não constituem resultado de teste. Não houve rerun ou commit artificial para destravá-los.
- Antes deste release, domínio oficial: HTTP 200 para home, cadastro, login, galeria de técnicos, área do técnico, área do cliente, privacidade, robots e sitemap; rota aleatória inexistente com HTTP 404 real; páginas privadas com `noindex`.
- Supabase dedicado consultado somente em leitura: **5 técnicos aprovados, 0 solicitações registradas** no momento da consulta.
- O deploy `dpl_8kj9aFCqheYmnTVMG5EDsCMRNq5X` foi cancelado pelo Ignored Build Step: a configuração aceita apenas títulos de commit com `release:` ou `[publish]`. Esta nota de release registra o lançamento real e usa o mecanismo já existente.

## Limite de aceite e segurança
A publicação HTTP e os testes de código NÃO equivalem ao E2E autenticado. Ainda falta validar com contas consentidas de cliente e técnico: login Google/redirects Supabase Auth, criação/leitura privada da solicitação, compartilhamento manual, isolamento de contas e UX Android/iOS. Não criar usuários/solicitações fictícias e não ativar cobrança ou exposição de telefone para estes testes.

Sem alteração de DNS, registros reais, SQL do banco, WordPress, Lovable, segredos, AdSense ou política de preços. O deploy não habilita RPCs administrativas propostas que ainda não existem em produção.
