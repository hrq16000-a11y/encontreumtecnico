# Codex + Supabase MCP — Encontre um Técnico

Projeto: `pqtzhctvjbfcunmrvxne`. Não usar outro projeto Supabase ou criar banco novo.

## Configurar no ambiente Codex do operador
O **Codex CLI precisa estar instalado e autenticado no computador que executa a ferramenta**. Configurar este repositório não autentica automaticamente a máquina.

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=pqtzhctvjbfcunmrvxne&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cfeedback%2Cnotebooks"
codex mcp login supabase
codex mcp list
```

Em uma sessão Codex, use `/mcp` para inspecionar status. O login OAuth deve ser concluído pelo operador no navegador. **Não colocar PAT, cookies, credenciais, strings de conexão ou segredos no GitHub**.

Skills opcionais (avaliar consumo e instalação local antes de executar):

```bash
npx skills add supabase/agent-skills
```

## Limites operacionais obrigatórios
- Inspecionar e homologar esquema e regras antes de qualquer mutação SQL.
- Supabase tem tabelas Lovable já criadas, incluindo `profiles`, `user_roles` e `technicians`: não recriar ou sobrepor as migrações.
- Não importar, expor ou versionar telefones do grupo WhatsApp; dependem de validação e consentimento.
- Não executar `DROP`, `TRUNCATE`, delete em lote, `ALTER` destrutivo, importar dados pessoais ou mexer em RLS sem plano de reversão e revisão.
- Não alterar produção WordPress nem DNS. GitHub/Vercel apenas em branch/preview até prova de paridade.
- O MCP oferece ferramentas que **podem escrever no banco**; exigir revisões para mudanças sensíveis. Para auditoria exclusivamente de leitura, configurar outro servidor MCP com `read_only=true`.

Documentação: https://supabase.com/docs/guides/ai-tools/mcp
