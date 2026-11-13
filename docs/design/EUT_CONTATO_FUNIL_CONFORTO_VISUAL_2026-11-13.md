# Encontre um Técnico — governança de contato, funil e conforto visual
Data: 13/11/2026
Escopo: portal público. Documento de decisão de produto, sem autorização para alterar SQL, RLS, DNS ou dados.

## Problema observado pelo proprietário
Capturas reais das seções Home (atendimento local/nacional, FAQ, contato, cliente/técnico e rodapé)
e da rota /contato mostram superfícies predominantemente muito claras, excesso de texto em cartões,
pouca diferenciação de blocos e pouca profundidade visual. O bloco “Fale com a equipe do portal”
exibia dois CTAs concorrentes e telefone direto. /contato oferecia mailto como CTA público.
A experiência deveria ser mais expressiva, confortável e orientada ao fluxo.

## Regras aprovadas
1. **Contato geral do portal:** não exibir tel:, mailto:, wa.me ou números como atalhos.
   Iniciar por funil de assistência; registrar primeiro o pedido na caixa interna `contact_messages`
   e oferecer WhatsApp somente após registro bem-sucedido e escolha explícita do usuário.
2. **Home:** um CTA “Pedir ajuda ao portal” chama o fluxo de gestão assistida, pré-preenchido
   com “Quero ajuda da equipe do portal. Estou na página inicial do Encontre um Técnico.”
3. **/contato:** central de ajuda acionável, com atendimento guiado contextual, ajuda de acesso,
   navegação até solicitações do cliente e opção de privacidade também por fluxo guiado.
   **Não prometer tickets numerados ou acompanhamento onde não há esse recurso.**
4. **LGPD:** preservar páginas legais e obrigações regulatórias, inclusive canais legalmente
   necessários; retirar e-mail e telefone da navegação comercial não significa eliminar
   direitos ou impossibilitar contato para assuntos legais. Privacidade independe de compra.
5. **Conforto visual:** menos branco puro no tema nativo, fundo azulado de menor luminosidade,
   cartões diferenciados, headings com bom contraste, CTA único por objetivo.
   Preservar temas importados, modo escuro e WCAG AA (texto >= 4,5:1; campos >= 3:1).
6. **Interação:** usar Lucide, sombras leves, hover/focus claros e entrada sutil.
   Respeitar `prefers-reduced-motion`; não instalar bibliotecas, parallax pesado,
   fontes ou imagens externas nesta rodada.
7. **Proteções:** preservar dados, contatos de técnicos, integrações financeiras inativas,
   autenticação e consentimento do funil. Não liberar contato antes do pagamento.
8. **Compatibilidade:** preservar fotografias da Home, SEO/canonical, rotas existentes
   e Drafts em andamento. Fazer releases somente após gates e verificação em produção.

## Execução P0
- `src/components/home-rich.tsx`: faixa de atendimento único em azul-marinho, sem telefone.
- `src/routes/contato.tsx`: central responsiva guiada, sem e-mail/telefone público.
- `src/lib/free-search-help.ts` + `src/components/assistance-funnel.tsx`: contexto
  inicial por origem e rascunho preservado; registro em `contact_messages` sem mudança de banco.
- `src/styles.css`: ajuste da paleta da interface nativa preservando CSS legado e dark mode.
- Testes de contrato e de contraste no GitHub Actions.

## Próximas rodadas (não incluídas aqui)
- P1: FAQ com interação/ícones, cards cliente/técnico, rodapé com maior presença visual.
- P1: fluxo formal de ticket e acompanhamento com autorização e políticas de login/RLS.
- P2: motion editorial leve por seção, auditoria de LCP/CLS, 390/1440 px e reduced motion.
- P2: parallax apenas quando mensurado, com fallback sem movimento e custo/LCP controlados.

**Critério de conclusão:** Código aprovado não equivale a atendimento operacional,
a ticket autenticado nem a QA visual real. Só declarar implantação quando deploy
READY e rotas oficiais responderem corretamente.
