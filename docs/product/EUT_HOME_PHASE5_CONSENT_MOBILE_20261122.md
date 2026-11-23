# Fase 5 — Home confiável, mobile e pop-up opcional (22/11/2026)

## Estado verificado antes da intervenção

- Base `main`: `d6c101bf73eb31efdaffd932a14fe6defde20b88`; o portal já possuía fotos reais, cards com quatro categorias visuais, o componente `HomePublicProof` alimentado por `listApprovedTechnicians` e gerenciamento de campanhas no Admin.
- As PRs **#436, #442, #447 e #449** estavam abertas e Draft. Esta rodada não as modifica, nem instala SQL, reconfigura RLS, muda pagamentos, publica no Vercel ou habilita visitantes A/B/C.
- O banner editorial de comunidade existe independentemente da opção de publicidade. Até agora o **pop-up flutuante** podia abrir sem essa opção; isso foi corrigido.
- Não inserir testemunhos, contadores de usuários online, estimativa de chamados ou avaliações não comprovadas. Exemplo de perfil publicado **não** é certificação.

## Mudança da micro-rodada

1. O pop-up flutuante só pode ser agendado e exibido com **consentimento de Publicidade** no navegador. Continua **não-modal**, após 11 segundos, no máximo uma vez por sessão, sem roubar foco, sem interromper digitação nem encobrir a decisão de cookies. A revogação em qualquer aba fecha pop-ups em andamento e cancela anúncios em memória. Sem opt-in, a seção editorial de comunidade segue disponível sem telemetria opcional.
2. O pop-up respeita `safe-area-inset-bottom`, limita altura a 70dvh, tem rolagem própria quando necessário e mantém o botão dispensar acessível em 390 px. Nenhum pacote novo e nenhum evento de conversão artificial.
3. A busca inicial fica empilhada no mobile/tablet e vira linha apenas em `lg` (desktop); inputs com `min-w-0` não forçam rolagem horizontal. A Home inclui link para a **vitrine de perfis públicos reais**, sem prometer quantidade, verificação profissional ou disponibilidade.
4. O painel de conteúdo público explica a separação entre convite editorial e publicidade opcional. O módulo atual de campanhas continua o único ponto de edição/auditoria. O texto fixo da comunidade **ainda não tem editor persistente**; não se simulou CRUD novo.
5. Testes existentes da Home e do pop-up atualizados com consentimento explícito, revogação, caso sem consentimento, mobile e prova social sem dados fabricados.

## Pendências administrativas preservadas

- Não tratar publicação do perfil como prova de identidade ou certificação; correções e status permanecem no CRUD já existente.
- Evolução futura, em micro-PR separada e com autorizações cabíveis: editor auditável da seção editorial de comunidade, ordenação/configuração da vitrine pública, QA autenticado 390/1440 e evidência HTTP após eventual integração.
- Fases 3 e 4: coletores A/B/C, antiabuso atômico e respectivos painéis ainda não ativados — nenhum `GO` de produção implícito nesta PR.

**Estado esperado:** PR Draft isolada, validação CI e testes direcionados; sem merge, deploy, SQL ou exclusão de branches.
