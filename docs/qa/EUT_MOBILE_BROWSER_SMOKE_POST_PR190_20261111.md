# EUT — Homologação mobile posterior à PR #190

Data: 11/11/2026. CI de navegador somente leitura; produção e contas reais preservadas.

## Escopo efetivamente verificável
- O GitHub já registra 19/19 gates verdes da PR #190, com commit de publicação `29c8577b`.
- O projeto agora avançou para commits posteriores. Testar **o deployment READY atual**, não um preview ou clone.
- O workflow `.github/workflows/eut-browser-smoke.yml` usa Chromium real em
  runner Ubuntu e contexto com **emulação de dispositivo móvel**. O script
  `scripts/eut-browser-smoke.cjs` testa as larguras 320, 375, 390 e 768 px,
  percorrendo Home, /tecnicos e /lp2/galeria e apontando overflow horizontal.
- Também consulta DOM real do filtro UF, município e bairro. Em São José dos
  Pinhais/PR, confirma autocomplete com `Itália` e a digitação livre
  `Jardim Itália`; nunca salva ou publica nenhum formulário.
- Navegação sem sessão testa restauração de pesquisa pendente, histórico,
  recarga da Home2 e galeria e exclusão do editor privado de áreas autenticadas.
- Como os smoke tests executam contra a produção anterior ao merge, a altura
  do seletor UF é registrada como *diagnóstico*. Um gate separado no mesmo
  workflow valida os 44 px pela classe `min-h-11` do código revisado. Após
  publicar, repetir o teste live para validar a altura renderizada.

## Falhas demonstradas no código e correções
1. /tecnicos: seletor UF tinha a classe `h-10` (40px), enquanto controles
   vizinhos usavam `min-h-11` (44px). Corrigido com alteração local de classe.
   O CTA de busca por região também foi alinhado a 44px.
2. O smoke test existente ainda procurava placeholder `Ex.: Curitiba`,
   anterior à mudança da PR #187 para `Município (ex.: Curitiba)`.
   Corrigido o teste para não declarar falso erro do portal.
3. Novo teste de rolagem horizontal e filtros geográficos para múltiplas
   larguras. Nenhuma alteração de banco/cadastro/SSO ou dados.

## Limitações — não declarar teste em dispositivo físico
- Chromium com modo mobile NÃO substitui Chrome Android físico nem Safari
  iOS/WebKit real. Não há navegação gráfica autenticada nesta sessão.
- Sem identidade técnica de QA autorizada, não é seguro preencher o painel
  /area-tecnico em produção, clicar Salvar, publicar perfil ou modificar
  qualquer bairro real.
- Validar manualmente, quando houver dispositivo e conta QA autorizados:
  * Seleção por toque no município IBGE e sugestões de bairro
  * Jardim Itália digitado, Alt+Tab, voltar/avançar e recarga
  * Confirmação/cancelamento ao trocar UF ou município
  * Galeria e perfis sem barra horizontal em 320, 375, 390 e 768 px
  * Nenhum contato privado ou valor fictício exibido
- Em falha do smoke browser por indisponibilidade da rede CI, distinguir
  bloqueio ambiental de erro de código; nunca relaxar thresholds para publicar.
