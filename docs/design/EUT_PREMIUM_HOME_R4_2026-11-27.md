# Encontre um Técnico — experiência premium da home, R4/10

Data: 27/11/2026. Candidato visual isolado, não publicado.

## Base e diagnóstico

- Produção verificada em Vercel READY: `f5952a6b708b3b63f207952e9584898491228eec` (deploy `dpl_5L7GejCyNqN4fNFm3TXSdry1jjST`).
- Base main de integração: `5af94a76f4f8fac46978021133bcc58924cc26b4`.
- As duas fontes alteradas e os testes existentes de Home eram idênticos entre main e READY antes da edição.
- Home oficial revisada: 22 seções, foto e busca na primeira tela, recuperação de cadastro, expansão, especialidades, canais local/nacional, confiança, categorias/perfis, assistente, etapas, comunidade, cobertura, FAQ, ajuda e jornadas. Repetição de cartões, hierarquia pouco clara entre mensagem e busca; sete wrappers Reveal com conteúdo inicialmente invisível, incluindo assistente, cobertura e FAQ; foto com etiqueta flutuante continuamente.

## Implementação

- Hero editorial com fundo institucional, H1 e copy preservados, painel de busca independente com rótulos permanentes, botão de 48px e sugestões acionáveis de especialidades (slugs existentes).
- Preserva recuperação SSR-safe do rascunho, normalização, sugestão regional IP,
  prioridade, correção manual de cidade, telemetria e destino /tecnicos;
  durante recuperação há alternativa nativa ao diretório. Sem rascunhos vazios editáveis antes da hidratação.
- A imagem original permanece, em composição estática com legenda; nenhuma animação de entrada ou loop no hero.
- Sem Reveal na Home: todos os 22 módulos são mantidos, com conteúdo presente e visível desde SSR; a abstração compartilhada de motion não é alterada.
- Cards de categoria sempre exibem link e feedback breve, etapas agrupadas semanticamente (ol com li), links regionais compactos. Microtransições CSS de 150ms, com transition-property none para reduced motion, sem novas dependências.
- Preservados SEO/canonical, ilustrações locais, as duas fotos, cadastro, comunidades, ads, cobertura e privacidade. Sem alteração de DB, painel, LP2, pagamentos, rotas, perfis ou integrações.

## Evidência local (sobre produção READY, não main divergente)

- Instalação com Bun 1.4.5, lockfile congelado.
- 175 arquivos Vitest, 890/890 testes aprovados, incluindo 3 guardas R4.
  Primeira execução falhou em um contrato textual de placeholder (restaurado)
  e bunx ausente no ambiente (resolvido no runner); nenhuma flexibilização de teste.
- Build SSR Vite/Nitro aprovado com preset local node-server e ambiente de teste.
  O routeTree gerado não é parte do diff.
- Chromium 390x844, 768x1024 e 1440x900: HTTP 200, 1 H1, 22 seções,
  zero overflow, nenhum erro JS de página; primeira fotografia carregada.
  Seleção por teclado de Informática => computadores, aria-pressed,
  correção manual de município limpa UF/bairro anteriores, rascunho restaurado
  após reload, navegação correta a /tecnicos com especialidade e cidade.
- FAQ e regiões visíveis sem revelar por scroll; fallback ao diretório e FAQ
  visíveis sem JS. Estilos compilados respeitam reduced motion.
- Inspeção visual do hero mobile e desktop. O QA utilizou stub local e interceptou
  requisições externas (erros de rede esperados de bloqueio no console), sem
  inserir dados ou enviar leads no Supabase real.

## Integração segura

PR de integração em main, sem promoção automática. Produção diverge de main;
a futura release deve usar o READY comprovado e transportar apenas os blobs
revisados desta microalteração, preservando as mudanças operacionais em produção.
Não publicar main cegamente. Concluir CI no head exato, conferir o SHA de release
e rollback, publicar uma única vez e validar domínio real após o fechamento R3.
