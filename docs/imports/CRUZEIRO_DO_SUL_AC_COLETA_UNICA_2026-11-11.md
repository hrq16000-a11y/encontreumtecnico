# Coleta única — Cruzeiro do Sul/AC · Técnico de Informática

Data: **2026-11-11**. Página de origem:
https://guiafix.com.br/cruzeiro-do-sul-ac/tecnico-de-informatica

## Coleta realizada
- **Uma única consulta** ao endereço completo e à categoria específica; sem paginação, fichas individuais, links de WhatsApp ou repetição.
- O resultado consultado estava indexado há aproximadamente **2 meses**: não comprova atividade, identidade, especialidade ou atendimento atual.
- A página exibe contador **950** e informa **53** listagens de serviço. **Somente 53 nomes completos de cabeçalhos** foram separados, sem conteúdo de apresentação, contatos, avaliações, telefones, endereços, imagens ou links.
- Município oficial validado no catálogo IBGE do projeto: **Cruzeiro do Sul/AC, código 1200203**.
- Arquivo: `data/external-staging/guiafix-cruzeiro-do-sul-ac-tecnico-informatica.capture.json`.
- Não consultar essa mesma combinação cidade/categoria novamente como parte da coleta.

## Estado da importação
- `status: quarentena_nao_reivindicado`, `claimed: false`, `authorized_contact: false`, `published: false`.
- **0 contas criadas, 0 prestadores ativados, 0 contatos liberados e 0 envios a terceiros.**
- Fonte externa NÃO equivale a cadastrado, verificado, disponível ou atendente do Encontre um Técnico.
- Confrontar futuramente com técnicos aprovados, banimentos, listas de bloqueio e legado WordPress antes de qualquer exposição, sem tratar coincidência nominal como prova de identidade.
- Não inserir esses registros nas tabelas `technicians`, `user_roles`, `legacy_review_profiles` ou em sitemaps de perfis.
- Exigir opção de correção/retirada, governança LGPD, compatibilidade com regras da fonte e reivindicação voluntária autenticada antes de vincular perfil a titular.

## Revisões de qualidade necessárias
- Alguns nomes de terceiros incluem o texto padrão "Técnico de Informática Cruzeiro do Sul" no título da listagem. Isso **não prova atuação em Cruzeiro do Sul**.
- O nome listado como "TFS Tech ... São Miguel Paulista Cruzeiro do Sul" menciona outra região. Não assumir cobertura local.
- Títulos genéricos como "Serviços de Informática" e "Aluguel de Impressoras" não bastam para confirmar atividade, disponibilidade ou identidade.
- Não reproduzir cinco estrelas, certificações, selos, número de avaliações, mídia ou qualquer indicação de confiabilidade da fonte.
- O contador 950 **não representa 950 registros prontos para o nosso portal**.

## Funil permitido (sem consentimento de terceiro)
Utilizar somente solicitação regional **neutra** já prevista na Issue #201 e PR draft #205, cujo registro depende do cliente autenticado. Não direcionar a um dos nomes externos, não criar perfil de contato nem afirmar que o profissional foi notificado.

## Gates
`node --test scripts/external-directory-batch.test.mjs scripts/external-directory-snapshot.test.mjs scripts/external-directory-cruzeiro-do-sul.test.mjs scripts/external-directory-cruzeiro-do-sul-snapshot.test.mjs`

Todos os testes são offline, sem chamadas HTTP, sem banco nem credenciais; homologação de produção depende dos workflows. Não fazer merge/deploy com gates pendentes ou com risco de cruzamento de banimentos.
