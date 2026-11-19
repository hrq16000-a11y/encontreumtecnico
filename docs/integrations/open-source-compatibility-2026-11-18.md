# Compatibilidade de ferramentas abertas — Encontre um Técnico

Triagem inicial: 18/11/2026. **Status: conhecimento incorporado; nenhum sistema externo habilitado.**
O código, o Supabase dedicado, o catálogo, o painel e a publicação controlada continuam canônicos. Nenhuma integração pode criar distinção pública entre técnico novo, importado ou histórico.

## Candidatos de valor

| Ferramenta | Fonte oficial | Uso compatível | Requisito antes de ativar |
|---|---|---|---|
| Chatwoot | https://github.com/chatwoot/chatwoot | fila privada de atendimento de solicitações | provar necessidade além do funil atual; consentimento, RLS e retenção; não revelar telefone de técnico |
| Documenso | https://github.com/documenso/documenso | documentos privados de OS ou contratos administrativos | API server-side e trilha auditável; separar destinatários, tenant e permissões |
| Cal.diy | https://github.com/calcom/cal.diy | agenda administrativa quando houver atendimento agendado real | não criar intermediação pública, pagamento alternativo nem reserva falsa; edição comunitária sem módulos comerciais multi-tenant |
| Penpot | https://github.com/penpot/penpot | protótipos de mobile e painel 360° | apenas design; preservar acessibilidade e componentes próprios |
| Cap | https://github.com/CapSoftware/Cap | vídeos de orientação sem dados reais | gravar telas de demonstração fictícia e remover PII |
| Buzz | https://github.com/chidiwilliams/buzz | transcrever tutoriais internos autorizados | operação local; não enviar conversas ou áudio de clientes |
| Postiz | https://github.com/gitroomhq/postiz-app | distribuição de guias e anúncios oficiais | contas sociais e OAuth separados; não publicar perfis privados |
| Plane | https://github.com/makeplane/plane | gestão interna de demandas, se GitHub Issues não bastar | não duplicar fila nem conceder acesso aos dados de clientes |
| LibreTranslate | https://github.com/LibreTranslate/LibreTranslate | tradução editorial futura, se existir público multilíngue | revisar qualidade e SEO; servidor próprio e limites de uso |
| Twenty | https://github.com/twentyhq/twenty | CRM apenas se surgirem requisitos não atendidos pelo admin | não substituir banco/CRUD atual nem sincronizar telefone sem consentimento |
| REA | https://github.com/morluto/rea | investigação opcional de fluxos públicos autorizados | revisão integral de segurança, versão fixa e ambiente descartável |
| DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness | referência de arquitetura de agentes | developer preview; sem execução no painel ou acesso a segredos |

Ferramentas de desktop/produção (`Kokoro`, `Podcastfy`, `Upscayl`, `Handy`, `Cherry Studio`, `Anarlog`) podem ser usadas por operadores autorizados sem integrar-se ao site. `Inbox Zero`, `Agentes Chat`, `SiYuan` e `Vane` não justificam serviço novo neste estágio.

## Regras inegociáveis de implantação

1. Telefone do técnico não entra em HTML, logs, JSON-LD, analytics, buscas, chat público nem payloads para terceiros sem autorização explícita do titular.
2. O cliente chega ao contato do técnico pelo **funil e regras comerciais existentes**, com consentimento/persistência. Não criar atalho via Chatwoot, agenda, CRM, WhatsApp ou bot.
3. Cadastros nascem habilitados conforme regra de negócio vigente; bloquear/suspender/banir é função administrativa auditável. Não classificar técnicos por fonte de cadastro.
4. Não criar segundo banco, Auth, gateway de pagamento, serviço de IA ou CRM como efeito lateral. Qualquer serviço externo precisa de licença, host, custo, armazenamento, identidade de operador, opt-in, política de retenção, chave server-side e rollback.
5. A integração começa com adaptador isolado e desativado por padrão. Mudanças de banco/RLS, migrations, DNS, pagamentos ou publicação exigem escopo e validação específicos. Nunca implantar pela simples presença deste documento.

## Referências visuais compatíveis

- https://vitormenoli.com/ — clareza do hero, CTAs hierarquizados, cards de projeto com demonstração e busca/filtros de acervo. Adaptar **função e legibilidade**, não layout, identidade ou conteúdo.
- A ideia de catálogo pesquisável ajuda o painel de técnicos e a central administrativa, mas **a busca deve continuar vinculada a autorização no servidor**, paginação e filtros gerenciáveis, sem expor contatos.
- Não copiar prompts ou código dos repositórios do autor sem checar licença e segurança.

## Ordem das micro-rodadas

1. Verificar se o próprio painel tem todas as funções esperadas de busca, filtros, paginação e histórico antes de considerar um CRM externo.
2. Se surgir caso comprovado de atendimento multicanal, especificar piloto Chatwoot isolado, com testes de consentimento/privacidade e sem intermediação.
3. Se houver demanda documental real, pilotar Documenso server-side para um fluxo administrativo com consentimento, auditoria e reversão.
4. Expandir somente após CI e QA, com SHA e deployment verificados. Nenhuma dessas etapas é considerada executada por esta triagem.

**Rodada documental:** sem novas dependências, gravações, consultas à base, segredos, deploy, novas contas ou fluxos públicos.
