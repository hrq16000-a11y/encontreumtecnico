# Encontre um Técnico — micro-rodada de bairros e cadastro mobile
Data: 11/11/2026. Escopo: código e testes sem contatos, cadastros ou SQL alterados.

## Fontes oficiais e cobertura
- SJP/PR (IBGE 4125506): 41 nomes de referência da Prefeitura:
  https://www.sjp.pr.gov.br/mapas-do-municipio/
- Curitiba/PR (IBGE 4106902): **somente os primeiros 19 nomes conferidos**
  no arquivo GTMBAIBAIRRO do SIGMU, Portal de Dados Abertos, disponibilizado
  em 11/11/2026:
  https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=236fb6f7-f2a0-4b04-99b3-5be5eb34672d
  Curitiba tem 75 bairros oficiais, mas esta rodada **não** declara catálogo completo.
- Restante dos municípios: digitação livre, sem sugestões inventadas.
- Sugestões municipais são opcionais, não geocodificação de endereço.
  GPS/IP nunca preenche bairro. Exemplo: "Itália" pode ser sugerido em SJP;
  "Jardim Itália" é mantido integralmente quando digitado pelo titular.

## Correções de navegação e mobile
- Botões de sugestão dentro de área rolável de altura limitada e alvo de toque
  mínimo de 44px; não dependem de datalist nativo do navegador.
- Campos de município e bairro têm rótulos distintos e fonte visível.
- Troca da UF/município com bairro/regiões preenchidos mostra confirmação
  nativa ANTES de limpar os campos dependentes. Cancelamento preserva tudo.
- Confirmar o mesmo município pelo IBGE preserva os textos digitados.
- Inputs geográficos e selectores têm alvo de toque mínimo de 44px.
- Rascunhos são salvos antes de navegação/Alt+Tab; sem manipulação de sessões.

## Gates automatizados
- Unitários: catálogo municipal com IBGE e UF, CPF/telefone não acessados,
  troca segura de município, teste de MunicípioPicker simulando larguras de
  320px e 375px, debounce, cadastro e galeria.
- Verificar build, TypeScript, SEO e privacidade via CI já estabelecida.

## QA manual real ainda necessário (não simulado com contas de produção)
Abrir com conta de QA autorizada nos navegadores Chrome Android e Safari iOS,
resoluções 320px, 375px, 390px e 768px:
1. No painel do técnico, conferir IBGE, teclado de busca e lista de bairros.
2. Digitar Jardim Itália; sair, Alt+Tab, voltar e recarregar — texto íntegro.
3. Abrir sugestões, escolher "Itália" por toque e reescrever "Jardim Itália".
4. Trocar município SJP → Curitiba; confirmar/cancelar; verificar que não
   transporta bairros de outro município inadvertidamente.
5. Trocar UF; confirmar/cancelar e verificar integridade do rascunho.
6. Buscar pelo bairro em /tecnicos; testar voltar/avançar e filtros.
7. Verificar galeria/LP2 sem bairro inventado, contatos privados ou scroll
   horizontal, com alvos de toque, foco visível e teclado na tela.
8. Validar que o perfil técnico só é publicado pelo RPC autorizador.

**Status:** os testes de largura simulada em JSDOM não substituem browser E2E
ou dispositivos reais. Sem conta de QA autorizada e navegador conectado,
não é possível marcar como homologado em Chrome Android/Safari iOS.
