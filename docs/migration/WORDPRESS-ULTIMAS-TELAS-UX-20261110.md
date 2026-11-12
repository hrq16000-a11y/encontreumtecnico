# Últimas telas do WordPress — referência visual (10/11/2026)

**Fonte:** capturas fornecidas pelo administrador e HTML da antiga /lista-de-clientes/?ajax_filter=true&employer_page=22&per-page=10&sort-by=recent&posted=all. O HTML integral é um snapshot privado fornecido no chat, NÃO importado ao Git devido a contatos, cookies e dados antigos. Não depender de URLs /wp-content/ ou PHP.

## Observações verificadas
- Listagens antigas: **385 técnicos** e **251 clientes** nas capturas; contagens de tela histórica, **não** profissionais/contratantes atualmente autenticados ou disponíveis.
- Campo de busca com termo, cidade/CEP, setor; filtros laterais de data/local/setor; ordenação recente e paginação. O novo portal mantém categorias e localidades próprias, sem impor a antiga categoria TI.
- Perfis: avatar, nome, profissões/setores, sobre e contato; no antigo, telefones, e-mails e WhatsApp apareciam PUBLICAMENTE. **NÃO repetir no novo sem o gate privado e consentimento explícito**.
- Duas áreas de clientes antigas contêm dados de demonstração/placeholder. Não republicar textos, dados ou avaliações automaticamente.
- Cor de destaque antiga do Careerfy: **#13B5EA**, fundo branco, cinzas neutros; estados interativos de scroll, cabeçalho fixo e efeitos de menu.
- Fontes de referência no HTML: Roboto, Merriweather, Ubuntu, Kodchasan, Abel, KoHo. O site atual já usa Manrope e Sora; não importar dezenas de pesos nem fontes binárias do WordPress. Se for necessário ajustar tipografia posteriormente, usar URLs publicadas por fornecedor autorizado e `font-display:swap`.
- JS de sticky header da origem adicionava classe após 230/650px de rolagem. Refeito com header sticky já existente e sombra nativa leve. Scroll ao clicar em âncoras, pular para conteúdo e voltar ao topo com CSS/JS nativos; ao reduzir movimento do sistema, desativar a animação.
- **Não copiar** careerfy.css, Elementor, Dashicons, WPBakery, jQuery, icon fonts, RevSlider ou o CSS de consentimento: são acoplamentos, não requisitos da UX. O novo sistema mantém navegação e consentimento próprios.

## Pendente em rodada separada
- Restaurar avatares e mídia original com relação confiável por ID WP. Código atual comprova **1 URL Cloudinary independente** para ID 530; demais referências ainda não têm arquivos verificados, não simular fotos.
- Verificar paridade histórica da URL de lista de clientes (no sistema novo, cliente é solicitante, não vitrine de contatos).
- Validar empiricamente o primeiro cadastro de técnico+cliente e solicitação persistida; nenhuma captura prova funcionalidade desse fluxo.
- Preservar a classificação Bronze apenas como pré-cadastro até comprovação da identidade.
