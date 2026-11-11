# Homologação autenticada isolada — 2026-11-11

## Escopo e fronteiras
Referência: PR #182 (sessões e rascunho seguro). Esta rodada NÃO equivale a login real homologado. Não executar operações de negócio, inserts, alterações de RLS ou exclusões no Supabase. Nunca usar credenciais de cliente/técnico/administrador reais sem autorização específica. Sem merge/deploy/publicação.

## Estado verificável nesta preparação
- Repositório: `hrq16000-a11y/encontreumtecnico`, main de origem.
- `package.json` declara Vitest (`npm test`), lint (`npm run lint`) e build (`npm run build`).
- Não há `playwright.config.ts` nem `tests/auth-session.spec.ts` nos caminhos verificados na main. Isto não prova ausência de todos os testes E2E em outras pastas.
- `AGENTS.md`: Supabase externo; RBAC/RLS; admin somente após verificação, nunca por metadata editável.
- **Status:** roteiro preparado; nenhum teste de autenticação real, mobile físico ou de navegador automatizado foi executado nesta rodada. Sem evidência para declarar gate aprovado.

## Identidades de teste
Executar SOMENTE em ambiente efêmero separado, isolado da base real, usando fixtures e sessões assinadas/testadas, sem credenciais de produção. Alternativamente, contas de QA previamente autorizadas e ambiente com controles explícitos de não persistência. Nunca injetar role admin via metadata do cliente ou contornar a RLS. Não enviar e-mail, SMS ou WhatsApp.

## Matriz bloqueante
Para **cada** papel (cliente, técnico, admin):
1. Anônimo -> privado: bloqueio de rota e SSR, sem vazamento em HTML/hidratação.
2. Sessão válida -> página própria; troca de rota interna e volta do histórico; não perder entrada.
3. Digitar texto sintético, mudar de aba (Alt+Tab), voltar: preservação sem sobrescrever com estado obsoleto.
4. Recarregar página e usar voltar/avançar: restaurar somente conforme escopo permitido e sem flash de campo vazio antes da hidratação.
5. Mobile 360x800 e 390x844, toque, teclado virtual e scroll, browser real quando disponível.
6. Expiração/logout: texto sensível não reaparece para outro usuário ou outro papel; dados do admin nunca vazam para técnico/cliente.
7. Duas contas isoladas: rascunho de A não surge para B. Guardar rascunhos com chave por usuário e papel, TTL esperado (admin 15 min para perfil público) e limpeza em logout.
8. No admin: selecionar técnico A, editar apresentação sintética, trocar módulo, retornar e **selecionar novamente o mesmo técnico**; validar restauração condicionada. Ao selecionar B, não reutilizar A.
9. Nenhum submit real: interceptar e bloquear requests mutantes (POST/PUT/PATCH/DELETE) à API de produção. Não gerar convites, banimentos, leads, pagamentos nem alteração de perfil.
10. Conferir console, erros de hidratação, requests involuntários, mudança de layout e regressões de SEO/SSR.

## Evidências mínimas para aprovar
Para cada caso registrar ambiente/commit, papel fictício, viewport, passos, resultado, screenshot ou log sanitizado, e requisições bloqueadas. Rodar `npm test`, `npm run lint`, `npm run build` em checkout isolado. Se Playwright não estiver configurado, instalar/testar somente em branch e sem deploy (não alterar build para configurar E2E). Reportar falhas reproduzíveis antes de corrigir.

## Bloqueios atuais
1. Não foram fornecidas/confirmadas identidades de QA autorizadas para sessão real.
2. Não há runner remoto de browser/testes autenticados acionado nesta interação; inspeção de GitHub não executa Vitest, lint, build nem interações no navegador.
3. Teste físico em celular/Alt+Tab não verificado nesta interação.
4. Sem logs e gates concluídos, **não realizar merge nem publicar**.

## Critério de saída
Somente declarar homologação após logs de testes, evidência autenticada isolada para os 3 papéis, ausência de vazamento/requests mutantes e gates verdes. Corrigir defeitos demonstrados em micro-rodada separada.
