# Encontre um Técnico — paridade WordPress → Vercel (10/11/2026)

**Estado:** plano de cutover e acompanhamento operacional. **Não equivale a homologação de 100%.**

## 1. Política de deployment econômico

- `vercel.json` configura `git.deploymentEnabled=false`: **nenhuma branch**, inclusive `main`, deve disparar deployment automático ao receber push.
- O GitHub continua fonte da verdade. Abrir branches e PRs, rodar **testes, TypeScript e build em GitHub Actions**, reconciliar com a `main`.
- **Não** fazer Preview por commit. Fazer um único Preview com o SHA consolidado quando houver cota e só depois um único release manual para produção, verificado com o mesmo commit e rollback definido.
- O erro **HTTP 402 `api-deployments-free-per-day`** é limite real imposto pela Vercel: **não pode ser burlado pelo GitHub, API, CLI ou alternando projeto/equipe**. A configuração previne novas tentativas automáticas; não apaga o consumo ocorrido nem libera cota imediatamente.
- Não usar `Ignored Build Step` como solução da cota diária: um deployment criado e depois ignorado pode consumir limite de criação. Não desativar outros projetos sem auditoria própria.
- Na Vercel, deployments permanecem **manuais** mesmo que novas PRs sejam integradas. Isto impede publicação surpresa; exige também que o operador faça o release explicitamente quando os gates passarem.
- Jamais editar DNS, segredos, checkout, papéis administrativos ou infraestrutura durante essa sequência sem escopo autorizado.

**Checklist de release:** (1) PRs revisadas, (2) gates do HEAD, (3) paridade legada consultada no Supabase, (4) Preview homologado com uma única implantação, (5) liberação da cota Vercel, (6) deployment manual de produção SHA-alvo, (7) saúde de `/`, `/tecnicos`, `/entrar`, `/admin`, `/reivindicar-cadastro`, páginas inexistentes HTTP 404, (8) rollback pronto. Alterações posteriores de código **não** entram automaticamente no ar.

## 2. Inventário real da migração

Contagens de consultas **somente leitura** no Supabase `pqtzhctvjbfcunmrvxne`. São contagens de **registros em tipos diferentes**, portanto **não somar como total de usuários ativos**.

| Item | Estado medido |
| --- | ---: |
| Contas WordPress importadas | 913 |
| Conta nova com login Supabase | 1 |
| Técnicos novos ativos (`public.technicians`) | **0** |
| WordPress: técnico aguardando confirmação de titular | 404 |
| WordPress: cliente aguardando confirmação de titular | 508 |
| WordPress: administração legada em revisão manual | 1 |
| Diretório legado `candidate` | 385 |
| Diretório legado `employer` publicado | 251 |
| Diretório legado `employer` rascunho | 19 |
| Diretório antigo total | 655 |
| Perfis históricos em gerenciamento | 384, sendo 364 pendentes e 20 demos excluídas |
| Fichas em acervo público sanitizado | 310, sem contato habilitado |
| Rotas históricas mapeadas | 615, todas ainda em validação |
| Referências de mídia históricas | 434 |
| Mídias descartadas como placeholders | 316 |
| Mídias aguardando análise | 114 |
| Mídias com formato a revisar | 4 |
| Mídias transferidas e verificadas no registro de fila | 0 |
| Avatares com URL independentemente verificada no código atual | 1 (`wp_post_id=530`) |
| Pedidos de serviço novos | 0 |

As 20 demos não são técnicos reais nem devem receber contato ou indexação. Fichas históricas não ganham aprovação por importação. **Contatos, documentos e informações privadas permanecem bloqueados** até reivindicação, validação e consentimento aplicável.

## 3. Matriz funcional e lacunas P0

| Fluxo equivalente | Existe no código/banco? | Lacuna a fechar |
| --- | --- | --- |
| Cliente entra por Google/e-mail | Código sim | Homologar sessão real de novo cliente e criação de perfil; apenas 1 login real observado |
| Técnico cria conta e serviços | Código sim | Homologar ponta a ponta com conta de técnico, aprovação e perfil buscável; zero técnicos novos |
| Busca por categoria/serviço/localização | Código sim | Não misturar arquivo histórico sem região/serviços verificados nos resultados filtrados |
| Diretório WordPress | 655 importados; 310 no acervo público sanitizado | Revisão de categorias/cidade/bairro, exclusão de demos, publicação somente com titular |
| Acesso à ficha antiga com Google | RPC verificada, recuperação por e-mail/solicitação | Reivindicações reais dos 404 técnicos e 508 clientes ainda aguardando |
| Avatar e galeria originais | 434 referências; 1 entrega confirmada em código | Revisar 118 candidatas reais, obter arquivo autorizado, transferir com hash, associar 1:1 por `wp_post_id` |
| Contato privado cliente → técnico | Código e RLS presentes | Homologar fluxo 100% com conta real de ambos, triagem e sem exposição de telefone |
| Cliente sem técnico encontrado | Fluxo de demanda privada implementado | Homologar criação, fila e atendimento real, sem demanda fictícia |
| URLs antigas e SEO | 615 referências; 17 URLs no sitemap | Validar 200/301/404, canonicals, robots, linkagem, indexabilidade após cutover separado |
| Painel administrativo | Módulos reais parciais | Gestão global, comercial, relatórios, edição de cadastro com permissão e auditoria |
| Patrocínios | R4 pública; R5 backend aplicado | R5 UI aguarda PR #81/Preview; sem patrocinadores reais até contratação |

## 4. Ordem efetiva, sem regressão nem dados artificiais

1. **R0 Git-first**: desativar auto-deploys, rodar gates no GitHub e manter produção atual estável até homologação.
2. **R1 cadastro e correspondência**: ensaiar com contas reais autorizadas (cliente + técnico), confirmar Google, vínculo legada por email verificado, papéis separados, triagem e autorização de contacto. Nunca importar hash de senha WordPress para auth atual.
3. **R2 arquivos originais**: conciliar 118 imagens não descartadas com backups/ZIP já fornecidos; só publicar foto pertencente ao perfil e verificada byte a byte; o administrador vê divergências. Não criar avatar artificial associado a pessoa real.
4. **R3 especialidades e municípios**: revisão de dados legados sem perpetuar a categoria “TI” incorreta; município/UF/bairro e serviço exigem confirmação ou evidência.
5. **R4 recuperação e SEO**: reconciliação 615 rotas, 404 de páginas inexistentes e indexação, sem alterar DNS até cutover aprovado.
6. **R5 monetização**: concluir PR #81 quando um Preview puder ser feito, depois campanhas reais; nenhum anúncio falso.
7. **R6 operações administrativas**: painéis de clientes/técnicos, buscas, reclamações, trilha de auditoria, conteúdo e patrocinadores; gestão por papéis do servidor.
8. **Cutover**: somente após smoke test de cliente+técnico+admin, dados e mídia reconciliados, redirecionamentos confirmados e plano de rollback.

**Critério para chamar “100% funcional e equivalente”:** fluxos cliente→triagem→técnico, técnico→cadastro→aprovação→busca, reivindicação WordPress, permissões, contato privado, mídias válidas, moderação e URLs históricas devem funcionar em **ambiente publicado**, com evidência. O indicador `0` técnicos ativos **proíbe** declarar paridade completa.

## 5. Auditoria repetível

Executar, somente para leitura, `docs/sql/eut-wordpress-parity-readonly.sql`. Os resultados não contêm e-mails, telefones, URLs privadas nem dados individuais. O arquivo deve ser reexecutado após cada importação/aprovação real. Gates do GitHub verificam o contrato do código, **não** substituem o teste com usuários e o Preview Vercel.

**Fontes técnicas do controle de deployment:** configuração oficial Vercel `git.deploymentEnabled`, e regra de branches/autorização da equipe. Nenhum fluxo de Lovable Max foi usado.
