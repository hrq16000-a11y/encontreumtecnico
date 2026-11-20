# Release controlado — diretórios ricos e fotos públicas dos técnicos (#352)

- **Base:** `main` `e23dc2427350b214aed0dab7a29bb919ca514ff7`, contendo a PR #352 integrada após 5/5 workflows verdes.
- **Melhoria da PR #352:** páginas públicas de municípios e categorias com avatares cadastrados pelos próprios técnicos, fallback de iniciais, navegação interna rastreável, breadcrumbs, perguntas contextuais e CTA para ajuda. Não são fabricadas fotos, avaliações ou certificações.
- **Segurança:** caminhos de avatar validados no bucket público `eut-technician-avatars`, sem leitura de contatos privados, SQL, RLS ou dados cadastrais adicionais. Continuam vigentes as regras existentes de elegibilidade pública e os dois contatos suspensos.
- **Compatibilidade da main:** a PR #353 (sinais visuais discretos nos cards) já estava integrada e foi aprovada com 3/3 workflows no HEAD `35a09bdf32fc1ee5f302bc118cbca84e8c572372`; suas alterações públicas acompanham a mesma base consolidada.
- **Publicação:** utilizar prefixo `release:` para o Ignored Build Step do projeto, emitir um único deployment controlado, conferir o SHA e os aliases de produção somente com estado READY. Preservar rollback anterior, DNS, Supabase, RLS, contatos e suspensos.
