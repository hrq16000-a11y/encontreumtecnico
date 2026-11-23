# Pacote funcional EUT — registro de liberação controlada (22/11/2026)

> **Status:** documentação de preparação; **não é autorização de merge ou deploy**. As cinco PRs permanecem Draft enquanto o aceite final não for comprovado. Nenhuma das correções abaixo está certificada como publicada por este registro.

## Referências congeladas nesta preparação

- Repositório: [hrq16000-a11y/encontreumtecnico](https://github.com/hrq16000-a11y/encontreumtecnico).
- Base documental `main`: `766d6873bc5f9b5ba9f0546599b7f06e5cdac4bb` (confirmada antes de criar a branch documental).
- Projeto de produção: Vercel `msolus/encontreumtecnico`, ID `prj_VaqJJAu3HfqcsRtUqZmeD8LCOaIy`.
- Deployment de produção verificado: [dpl_F1wQJDsWMiTCWvMr5H8rdAaEcv4F](https://vercel.com/msolus/encontreumtecnico/F1wQJDsWMiTCWvMr5H8rdAaEcv4F), estado `READY`, SHA `f3a03ba4965a127bce84c8b8ed5b9b69c3d73b64`.
- Branch do READY: `release/eut-guides-427-on-ready-20261122`, distinta da `main`; aliases incluem `www.encontreumtecnico.com.br`.
- `vercel.json` da base registra `git.deploymentEnabled=false`: merge GitHub **não significa** deploy automático. Ainda assim, confirmar projeto e destino no momento da publicação.

## PRs, HEADs e evidências automatizadas

| Sequência | PR / função | HEAD exato | Checks SUCCESS | Estado de aceite |
| --- | --- | --- | ---: | --- |
| 1 | [#454](https://github.com/hrq16000-a11y/encontreumtecnico/pull/454) — contato privado ao alternar fichas | `ee35c57407b9c81f47857c1b093a05927411b206` | 2/2 | CI verde; QA visual/admin pendente |
| 2 | [#455](https://github.com/hrq16000-a11y/encontreumtecnico/pull/455) — paginação após atualização | `c38ec8d1896112c395f977cec0d2059dab375332` | 3/3 | CI verde; QA visual/admin pendente |
| 3 | [#458](https://github.com/hrq16000-a11y/encontreumtecnico/pull/458) — nome seguro e falha de rede no acervo | `7e7f7d016d65d988442ff2d9187f03087a1948af` | 5/5 | CI verde; QA visual pendente; mitigação apenas da apresentação |
| 4 | [#451](https://github.com/hrq16000-a11y/encontreumtecnico/pull/451) — cadastro/edição administrativo em modal | `db46ecc38fbfdc8050d12cd94dfc3010b693666c` | 4/4 | CI verde; QA 390/1440 e homologação autenticada pendentes |
| 5 | [#439](https://github.com/hrq16000-a11y/encontreumtecnico/pull/439) — Home e busca de técnicos | `c3d58e753d44dcbcc40dd35a2084d347d138772d` | 15/15 | CI verde; aprovação visual 390/1440 pendente |

**Total verificado:** 29 checks com conclusão `success`, nenhum `failure` ou em progresso nos HEADs acima. Uma ocorrência de `Supabase Preview` ficou `skipped` em cada PR (5 exclusões das contagens). Evidências: abas **Checks** nos links das próprias PRs. Não disparar novamente os jobs já aprovados apenas para documentação.

## Aceite estritamente pendente — não confundir com CI

1. **#454:** verificar em Chromium a 390/1440 px a troca sintética A → B → A, sem reutilizar telefone, status de suspensão ou estado de cópia da ficha anterior. Não consultar contatos reais.
2. **#455:** verificar a navegação e o botão Atualizar nas sequências sintéticas 25 → 5 (2ª página invalida) e 45 → 25 (3ª para 2ª), sem falso vazio ou overflow.
3. **#458:** verificar DOM, títulos, alt, iniciais e mensagem de falha de rede com nomes sintéticos e dados falsos; confirmar apenas a mitigação de apresentação.
4. **#451:** verificar modal a 390/1440 px, foco inicial, Tab/Shift+Tab, Escape, cancelamento, estados de erro e sucesso simulado. **Separadamente**, em ambiente e sessão administrativa autorizados, comprovar gravação, releitura, edição e arquivamento de registro sintético sem dados privados reais; mock não prova persistência HTTP.
5. **#439:** verificar a Home a 390/1440 px (sem rolagem horizontal), categoria ativa, UF, confirmação de município pelo IBGE, submissão e navegação para `/tecnicos`, foco e redução de movimento.

**Bloqueio de ambiente constatado:** uma tentativa anterior de QA visual não começou por ausência de checkout/dependências utilizáveis e isolamento externo IPv4/IPv6 comprovado. Não existe evidência de capturas 390/1440 desta tentativa. Não tratar CI verde ou screenshots históricos como homologação nova. Se não houver ambiente isolado, manter NO-GO sem improvisar instalações, runners ou workflows.

## Limites funcionais e privacidade

- **#454:** contatos privados continuam restritos à sessão/admin e à RPC existente; o teste sintético não comprova autorização backend de um usuário real.
- **#455:** a correção não modifica pedidos nem seu estado persistido.
- **#458:** o filtro protege renderização/alt/avatares, mas `display_name` ainda pode constar na resposta de rede do catálogo legado acessível ao navegador. **Não declarar privacidade de API resolvida**; sanitização anterior à resposta exige decisão separada de backend, fora deste release.
- **#451:** política de habilitação de fichas importadas permanece condicionada ao contrato operacional existente; não prometer ativação integral de importados por uma alteração só de UI.
- **#439:** preservar busca pública, catálogo IBGE, SSR, SEO, acessibilidade, funis e a localização apenas sugerida, nunca confirmada sem escolha explícita.
- Preservar contatos suspensos, dados/RLS do Supabase dedicado, Pioneiros, pagamentos e rotas legadas. Sem SQL, DML/DDL, importações ou alterações de dados nesta documentação.

## Procedimento proposto para integração — exige autorização independente

1. Fechar somente os aceites listados acima, em ambiente já equipado/isolado; se não houver comprovação suficiente, manter as respectivas PRs Draft e NO-GO.
2. Reconfirmar `main`, HEAD, checks e ausência de conflitos antes **de cada** integração. Não usar SHAs antigos sem revalidação; preservar commits posteriores. Não eliminar ou rebasear branches publicadas.
3. Com autorização explícita e restrita para cada operação, retirar Draft e integrar por ordem **#454 → #455 → #458 → #451 → #439**; registrar o merge SHA da `main`, reavaliar sobreposições de integração e interromper em divergência.
4. Registrar nesta seção os merges e as evidências finais somente após ocorrerem; o estado inicial abaixo é intencionalmente `NÃO EXECUTADO`.

| PR | Aceite final | Merge SHA | Estado |
| --- | --- | --- | --- |
| #454 | PENDENTE | — | NÃO EXECUTADO |
| #455 | PENDENTE | — | NÃO EXECUTADO |
| #458 | PENDENTE | — | NÃO EXECUTADO |
| #451 | PENDENTE | — | NÃO EXECUTADO |
| #439 | PENDENTE | — | NÃO EXECUTADO |

## Plano de publicação — preservar o READY existente

1. O commit READY `f3a03ba4965a127bce84c8b8ed5b9b69c3d73b64` e a `main` têm históricos divergentes. **Não apontar a produção diretamente para a `main`** nem supor que todas as alterações do READY estarão ali.
2. Depois dos merges autorizados, preparar uma única composição de release **a partir da árvore do READY vigente no momento da execução**, adicionando somente os blobs aprovados e preservando integralmente mudanças posteriores. Comparar por arquivo e bloquear sobreposição inesperada. Documentar árvore, pais, origem e SHA final do candidato.
3. Separar a **autorização de publicação Vercel** da autorização de merge. Confirmar projeto `msolus/encontreumtecnico`, target `Production`, branch/commit exatos, domínios/aliases, integridade de SSR/rotas e política `git.deploymentEnabled=false` antes de qualquer deploy.
4. Executar no máximo um deployment controlado, apenas se explicitamente aprovado. Comprovar `READY`, SHA, ID, domínio oficial, rotas afetadas e ausência de regressão de privacidade. Não afirmar publicação com base em build de Preview.
5. Em falha pós-release, parar a promoção e avaliar reversão pelo último deployment `READY` comprovado, preservando dados e sem SQL. Registrar IDs/evidências no GitHub.

| Registro da publicação futura | Valor atual |
| --- | --- |
| Candidato de release aprovado | — não preparado |
| Autorização de deploy | — não concedida |
| Novo deployment READY | — não executado |
| READY de referência / rollback | `dpl_F1wQJDsWMiTCWvMr5H8rdAaEcv4F` (`f3a03ba4`) |

## Conclusão documental

**Estado em 22/11/2026:** desenvolvimento das cinco PRs disponível em Draft, checks automatizados verdes, homologação funcional/visual final não concluída, sem merges deste pacote e sem publicação do pacote. Este arquivo foi criado **exclusivamente como registro de liberação e rastreabilidade**, não como evidência de QA ou aprovação para deploy.
