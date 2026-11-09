# Encontre um Técnico — paridade funcional antes do corte (08/11/2026)

## Portais e regra de segurança
- Produção legada intacta; **sem mexer em DNS, domínio, hospedagem WordPress ou cadastro original**.
- O domínio `encontreumtecnico.com` apresenta o diretório Careerfy/WP JobSearch (técnicos, clientes, atividades e autenticação). `precisodeumtecnico.com` é outro endereço informado como referência, associado a assistência técnica; confirmar a origem funcional exata antes da migração definitiva.
- O novo app `hrq16000-a11y/encontreumtecnico` e a Vercel `encontreumtecnico` são ambiente novo, **não homologado funcionalmente**.
- O projeto Supabase externo `pqtzhctvjbfcunmrvxne` foi conectado, mas na última verificação não havia tabelas de aplicação em `public`.
- Arquivos XML e mídias WordPress existem no acervo enviado pelo proprietário. Não equivalem a exportação completa do banco MySQL, contas, autorizações, relacionamentos e mensagens.

## Fluxos obrigatórios para considerar clone funcional
1. **Busca e diretório:** especialidade, cidade/região, apenas técnicos aprovados, paginação, perfis reais, fotos, atendimento por localidade e registro seguro sem telefone público.
2. **Técnico:** login Google, criação e edição de perfil, especialidades, áreas de atendimento, aprovação administrativa, suspensão, revalidação e prova de posse das contas antigas.
3. **Cliente:** login Google, consentimento, triagem do problema/equipamento/local, envio persistente, histórico e acompanhamento, sem divulgar dados privados.
4. **Admin:** autenticação autorizada por identidade verificada, RBAC/RLS, aprovações, moderação, solicitações e trilha de auditoria.
5. **Migração:** export MySQL da origem, inventário de tabelas e metadados Careerfy/JobSearch, mídias, relações, URLs, contagens e hashes; ensaio de restauração sem expor dados privados.
6. **Operação:** bloqueio de spam, logs, backup e rollback, teste ponta a ponta real com contas de teste, verificações SSR/SEO antes de qualquer transição.

## Situação verificada no GitHub novo
- `/entrar`: botão Google ainda desabilitado.
- `/admin`, `/area-cliente`, `/area-tecnico`: páginas provisórias sem operações reais.
- `/tecnicos`: listagem vazia sem fonte real.
- `/tecnicos/$tecnicoId`: apenas placeholder.
- `/`: filtro antes não propagava cidade e especialidade.
- A branch `feat/paridade-busca-isolada` corrige **somente** propagação dos filtros e adiciona teste unitário; isso não constitui cadastro, busca real nem migração completa.

## Gates para liberar domínio oficial
Todos os itens 1–6 operacionais, reconciliação de dados antigos, auditoria de privacidade e autorização de corte. Até lá: trabalhar isolado, não publicar mudanças no WordPress, não alterar DNS nem declarar '100% funcional'.
