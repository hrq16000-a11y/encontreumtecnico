# Coleta pública isolada — Almirante Tamandaré/PR · Técnico de Informática

Data: 2026-11-11. **Não é cadastro de usuários, nem importação em produção.**

## Coleta única realizada
- Fonte da página: https://guiafix.com.br/almirante-tamandare-pr/tecnico-de-informatica
- Uma consulta ao endereço indicado, sem paginação, sem abrir perfis individualmente, sem contornar bloqueios.
- Retorno: página indexada com **33 nomes de possíveis estabelecimentos/profissionais** identificáveis no texto. O contador `1228` exibido pelo site NÃO equivale a 1228 perfis distintos extraídos, nem garante precisão, atividade ou adesão ao portal.
- Evidência de fonte: arquivo `data/external-staging/guiafix-almirante-tamandare-pr-tecnico-informatica.capture.json`. Esse resultado é conteúdo cacheado da ferramenta, não comprovadamente atualizado em tempo real.
- Consulta única à home de https://encontrey.com.br/ no mesmo dia: três anúncios de outras especialidades; **zero importações** do Encontrey. Não abrir outros links sem etapa específica de importação.

## Limites de processamento
1. Categoria única `tecnico-de-informatica`; cidade única **Almirante Tamandaré/PR**, código IBGE **4100400**.
2. Retenção mínima: somente nome publicamente exibido e procedência de página/categoria/cidade. Não copiar fotos, biografias, avaliações, contatos, WhatsApp, dados de GPS, links de mensagens nem notas do anunciante.
3. Deduplicação por nome normalizado dentro do lote; depois, antes de eventual migração, confronto com técnicos/legados existentes para evitar cadastros duplicados. Nomes iguais não provam mesma identidade.
4. `status=quarentena_nao_reivindicado`, `claimed=false`, `authorized_contact=false`, `published=false`; nenhuma conta Auth criada, nenhum técnico ativado automaticamente, nenhum privilégio de painel, nenhuma missão ou disponibilidade inventada.
5. Não misturar este lote com as tabelas WordPress `legacy_review_profiles`/`legacy_public_archive` nem contornar gatilhos, RLS e banimentos; o schema `technicians` exige conta real. Evolução de schema somente após revisão de segurança e fluxo de reivindicação/retirada.
6. O funil de **solicitação regional** pode receber uma necessidade do cliente sem associá-la falsamente a prestador não reivindicado. Encaminhamento nominal/contato somente depois de adesão explícita e credencial autorizada.
7. Remoção/correção: oferecer pedido de retirada; não afirmar parceria, disponibilidade, atendimento ou certificação de terceiros.
8. Nunca executar uma segunda coleta para o mesmo par fonte/cidade/categoria como parte deste lote; se o site ocultar parte dos perfis, reportar amostra parcial e encerrar.

## Critérios bloqueantes para etapa posterior
- Validação de termos de uso, base jurídica para o tratamento de dados públicos, aviso e mecanismo de retirada (LGPD); terceiros **não** são usuários do portal.
- Aprovação de proposta de armazenamento separado do acervo WordPress; RLS e política pública não expõem registros em quarentena.
- Testes sintéticos de isolamento de contas, banimentos, duplicidade, SEO/SSR e não vazamento de telefone; QA mobile real.
- Fluxo de reivindicação autenticada demonstrado com provas de titularidade; nunca criar senhas/contas sem aceite.
- Sem merge, SQL, deploy ou publicação de perfis nesta rodada.

## Comandos de validação offline
`node --test scripts/external-directory-batch.test.mjs scripts/external-directory-snapshot.test.mjs`

Os scripts não fazem solicitações HTTP, não acessam Supabase e não modificam cadastros.
