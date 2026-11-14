# Publicação — gestão visual dos técnicos — 14/11/2026

- Código integrado: PR #285, commit `eff214299a064f01278ccd5b24db6eb44ffd81c5`.
- CI automático: EUT admin consolidated release gate — sucesso no HEAD da PR `fc8cb2cf61fd7c64092f932abb573a4530831c66`.
- Escopo: modos de exibição cartões/linhas/avatares, ordenação por nome/cadastro/atualização, filtros, ficha expandida, seleção por página e ações em massa auditadas usando as RPCs existentes.
- Ações em lote exigem justificativa e confirmação; cada registro recebe resultado individual. A visualização pública não expõe telefones completos.
- Sem SQL novo, sem alteração de RLS, DNS, pagamentos, dados ou contatos suspensos.
- A Vercel utiliza Ignored Build Step para apenas processar commits com título `release:` ou `[publish]`. Este registro faz a liberação controlada após o merge funcional, preservando a política de deploy.
- Verificar READY, SHA, URL oficial e acesso da área administrativa após a implantação. O acesso autenticado e gravação real não são comprovados apenas por build/HTTP.
