# Padrão anti-site genérico — direção de arte e motion
Atualização de escopo da R8/10 (27/11/2026). Normativo para decisões de UI; complementa AGENTS.md e gates locais; não autoriza alterações indiscriminadas nem quebra de identidade, publicação, pagamentos, DNS, banco, RLS, segredos ou funis.

## Referências de trabalho
- [TasteSkill](https://www.tasteskill.dev/) / [fonte](https://github.com/Leonxlnx/taste-skill): briefing, direção de arte, composição e referências visuais adequadas à marca, seleção de mídia autêntica, hierarquia e revisão no navegador. Reprovar a silhueta de template repetido (hero central com selo, grade homogênea, gradiente/glow e CTA indistinguíveis). Não banir padrões funcionais úteis.
- [Transitions.dev](https://transitions.dev/skill): revisar o inventário antes de editar; selecionar transições por estado (feedback, dropdown ancorado, modal, abas, ícone, confirmação, tilt) e tokenizar entrada/saída; explicar cada efeito com antes/durante/depois. Preferir CSS e primitives existentes.
- [React Bits](https://reactbits.dev/) / [fonte](https://github.com/DavidHDev/react-bits): catálogo exploratório de componentes, text/micro interactions, fundos e 3D; selecionar só o padrão pertinente ao produto, adaptar à identidade e testar custo. Conferir licença da versão e condições comerciais antes de reutilizar código. Não copiar elementos Pro, não instalar em massa.
- [Emil Kowalski](https://github.com/emilkowalski/skills): motion deve ter motivo, duração curta para ação frequente, interrupção natural, transform/opacidade, foco, suporte a reduced-motion.
Status: princípios estudados/adotados; nenhuma instalação externa, CLI ou script remoto executado, nenhuma dependência comprada. Em adoção de código, registrar fonte, versão/SHA, licença, dependências, impacto e alternativa estática antes de PR.

## Procedimento de trabalho (usar em cada mudança visual)
1. Auditar primeiro: ler página inteira, rotas, fontes, AGENTS e dados reais; comparar desktop/mobile e estado atual público; definir a jornada e CTA principal.
2. Redigir mini-direção de arte específica: público, problema, proposta, composição, tipografia, paleta existente, fotografia real e 3 palavras que definem a marca. Justificar por que não se parece com as outras marcas. Preservar logotipo, identidade, material autorizado e copy factual.
3. Desenhar ritmo e contraste entre seções: escala tipográfica legível, respiro, contraste, composição assimétrica quando fizer sentido, imagem com intenção e tratamento editorial. Evitar excesso de cards iguais, chips, ícones ornamentais, gradientes, slogans genéricos e números fictícios. Não substituir design consolidado só para aplicar uma biblioteca.
4. Selecionar 1–3 momentos assinados por página: conteúdo legível antes/depois, sem prender scroll, sem ocultar a primeira dobra; microfeedback 100–180ms; entrada contextual 180–300ms ease-out; saída curta. 3D não é obrigação: em loja/editorial pode enriquecer foto ou galeria, em busca/urgência manter leve. Não animar dimensões de layout ou filtros caros em loop. Preferir transform/opacidade, evitar transition: all.
5. 3D: área estável e hit target fixo; tilt limitado a cerca de 3–5 graus e profundidade visual moderada; só hover fine pointer, reset ao sair, foco estático, touch sem efeito, respeitar reduced-motion. Nenhum WebGL/três.js obrigatório, nenhum loop ou parallax por default. Sem esconder preços, resultados ou controles.
6. Conferir 320/390/768/1440, navegação touch/teclado, foco, contraste, texto sempre visível, estados loading/empty/error/success, redução de movimento e links; comparar antes/depois com mídia real. Validar build/testes/gates locais e integridade SEO, conversão e performance. Evidências e exceções em PR, sem afirmar PASS sem teste. 
7. Publicar somente a origem comprovada, após homologação exigida pelo projeto. Preservar o último deploy saudável; não alterar configurações para contornar o gate.

## Critério de rejeição
Sem roteiro de arte próprio, sem hierarquia e evidência da jornada, com template replicado, foto/estatística fictícia, motion compulsório ou regressão de acessibilidade/performance: devolver para revisão. Qualidade não se mede pelo número de efeitos. A aplicação é incremental, sem 11ª rodada e sem importar o esqueleto visual de outro projeto.

## Aplicação local — Encontre um Técnico
Busca/localização como protagonista, evidência real de perfis, painel funcional; seleção e filtros rápidos, preservação de release ativo, SSR, leads privados.

