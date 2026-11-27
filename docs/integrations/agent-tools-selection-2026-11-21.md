# Ferramentas externas para operação e evolução do Encontre um Técnico — 21/11/2026

**Estado:** referência operacional de seleção, sem pacote instalado, runtime alterado ou autorização de integração. Complementa `AGENTS.md`, `docs/integrations/open-source-compatibility-2026-11-18.md`, a skill `shared-reference-intelligence` e os gates existentes.

**Fontes consultadas:** https://andrelug.com/materiais/mapa-107 (20 ferramentas para conteúdo), https://andrelug.com/materiais/mapa-103 (24 agentes de programação), https://andrelug.com/materiais/mapa-104 (24 agentes operacionais) e os 19 links GitHub fornecidos diretamente. As listas não provam conformidade de licença/segurança; não executamos seus programas.

## Seleção por demanda comprovada

| Demanda EUT | Referência | Decisão |
| --- | --- | --- |
| Operações admin, cadastro, pesquisa, filas, RLS, RPC, autorização | [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill) para hipótese/fronteira/evidência; [PR-Agent](https://github.com/The-PR-Agent/pr-agent) como abordagem de revisão | **ADOTAR METODOLOGIA**, não criar auditoria artificial, duplicar PR/CI ou executar agente com credencial admin |
| Home, busca municipal, filtros, cards e Painel 360° | [Hallmark](https://github.com/Nutlope/hallmark), [Impeccable](https://github.com/pbakaus/impeccable), [Taste Skill](https://github.com/Leonxlnx/taste-skill) | **ADOTAR CRITÉRIOS**: hierarquia, busca funcional, estado vazio, responsividade 390/1440, foco, teclado, contraste, reduced-motion, SEO SSR; não importar template |
| Entender comportamento de fluxo de referência | [REA](https://github.com/morluto/rea), [Craft Anything](https://github.com/storytold/craft-anything) | REFERÊNCIA de análise ética; Playwright/fonte pública primeiro; sem cópia de marcas ou instrumentação de terceiros |
| Documentar decisões e contexto entre agentes | [Claude-Mem](https://github.com/thedotmack/claude-mem), [AI Memory](https://github.com/akitaonrails/ai-memory), [Context7](https://github.com/upstash/context7), [Spec Kit](https://github.com/github/spec-kit) | Preferir AGENTS/PR/issue e docs atualizados. Hooks de memória precisam revisar retenção, redaction, controle de acesso; não armazenar contatos/leads |
| Conteúdo explicativo/marketing futuro | [HyperFrames](https://github.com/heygen-com/hyperframes), [OpenShorts](https://github.com/mutonby/openshorts), [Rescript](https://github.com/wassgha/rescript), [VoiceStudio](https://github.com/debpalash/VoiceStudio), [Voicebox](https://github.com/jamiepine/voicebox) | PILOTO OFFLINE apenas com dados e voz consentidos, sem novo serviço no portal; conferir licença/infra, Remotion comercial se escolhido |
| Agentes operacionais e workflows | [Activepieces](https://github.com/activepieces/activepieces), [Windmill](https://github.com/windmill-labs/windmill), [Stagehand](https://github.com/browserbase/stagehand) | ADIAR: primeiro demonstrar falha em funções atuais; nunca permitir operações reais autônomas em dados/Supabase |
| Modelo gratuito e Android TV | [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi); [CleanYourTV](https://github.com/Gathin23/cleanyourtv), [TV Detox](https://github.com/Ansub/tv-detox) | FreeLLMAPI **não** é backend comercial; TV fora do produto web, apenas possível referência para categorias de assistência técnica |

## Roteiro de implantação por micro-PR

1. Identificar **um defeito real** e verificar a RPC, os testes e os componentes existentes. Não desenvolver ferramenta nova por referência a um catálogo.
2. Usar a skill pertinente como lista de verificação **de uma rota/tela/fluxo**; deixar rastreáveis arquivo:linha, comportamento esperado, observação, risco e rollback.
3. Testar somente regressões afetadas: dados sintéticos, estados normal/vazio/erro, permissão server-side e acessibilidade 390/1440. Não alegar QA se não executado.
4. Se a solução exigir executable/serviço terceiro: revisar licença/versão, dependências, contratos de dados, segredos, fluxo de saída, privacidade, custo, hospedagem e desativação **antes** de instalar. Não usar Max/Lovable por padrão.
5. Integrar somente via PR com checks. Sem mudanças automáticas de main, deploy, SQL/RLS, preços, telefone, dados ou suspensos pela seleção da ferramenta.

**Uso em outras áreas:** edição de vídeo/voz é fluxo de produção de conteúdo separado, não função de atendimento. Ferramentas Android TV podem informar guias de suporte, não integram a aplicação EUT.

**Verificação desta rodada:** documento de referência; **nenhum** teste de código, SQL, gravação real, CI ou deploy foi executado para esta curadoria.
