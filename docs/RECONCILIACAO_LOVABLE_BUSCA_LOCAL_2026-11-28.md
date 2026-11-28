# Reconciliação Lovable/GitHub — busca perto de mim (28/11/2026)

## Proveniência e controle de versão
- main: 235e02a93380a3af2164399782ccca5dd744ef27 (6 commits exclusivos, incluindo R7/R8);
- lovable-sync: dd2836b1c950b9461b9ac746ba4ef9a075f589ed (10 commits exclusivos, incluindo busca contextual);
- ancestral comum: 92380df35a7a42008369a4f7723275c116677cd2.
- backups remotos: backup/main-before-lovable-reconciliation-20261128-235e02a e backup/lovable-sync-20261128-dd2836b.
- Merge normal de dois pais, sem force-push, reset, squash ou rebase. Conflitos no funil, testes do funil e contexto: preservar os escopos R7/R8, reabrir os rascunhos da mesma chave e manter atribuição por origem sem parâmetros.
- GitHub é a fonte única. Não produzir alterações simultâneas na branch main na Lovable e no GitHub. Antes de aceitar rascunho, conferir SHA/base, reconciliar branch de sincronização, testar e sincronizar a prévia. Não dispensar um backup sem comparação; não redefinir main. Lovable para prévia e intervenções pequenas, sem Max mode.

## Direção e contrato de busca
- Público: cliente com problema técnico local. Identidade existente, fotografia e CTA principal preservados. Direção: simples, próxima, confiável.
- Home: um campo pesquisável de serviço/especialidade ativo e botão Encontrar agora. Cidade/UF visível e editável em painel recolhido; catálogo municipal existente, sem novo serviço de catálogo. Texto desconhecido ou ambíguo exige confirmação; preservar parâmetros e aliases existentes.
- Diretório: um seletor compacto de serviço/especialidade; localização e filtros avançados acessíveis sem multiplicar inputs na primeira dobra. Seleção da cidade e UF é o fluxo normal; pesquisa nacional é escolha explícita. Acesso direto ao diretório sem uma referência válida continua disponível, identificado como nacional.
- A referência explícita da URL ou do usuário tem precedência; referência de sessão corrigível em seguida; IP geolocalizado de forma aproximada pelo servidor Vercel (cidade/UF) somente quando disponível. Na chegada direta ao diretório, validar a sugestão com catálogo IBGE antes de aplicá-la. VPN, CGNAT, IP/operadora ou DDD não provam município ou endereço; não coletar identificadores de operadora nem inferir bairro.
- GPS é último recurso, acionado exclusivamente pelo visitante no painel de correção (autoIfGranted=false); informar consulta externa existente BigDataCloud, que recebe coordenadas/IP para resolver o município. Sem persistência de coordenadas no portal nem envio a analytics; não solicitar GPS na abertura. Bairro permanece manual.
- Se não há cidade/UF na home, solicitar correção no próprio painel antes de navegar. Cidade-base, municípios explicitamente atendidos e cobertura estadual declarada compõem a seção local. Não confundir outro município do mesmo estado ou outro estado com proximidade. Alternativas não locais ficam em detalhes recolhidos, rotuladas, sem promessa de cobertura. Nenhum raio físico fingido; distância exige dados que comprovem geometria e consentimento.
- Não alterar Supabase/RLS, dados, pagamentos, autenticação, CRM ou perfis em consequência desta rodada. PRs administrativos em andamento permanecem independentes.
- Publicação: confirmar CI, preview, SHA e QA HTTP; preservar deploy saudável para rollback. Não confundir commit sincronizado com deploy em produção.

## Critérios de aceitação
1. Curitiba/PR: Curitiba e cobertura declarada primeiro; Salvador/BA só em alternativas explicitamente abertas, ou se houver cobertura efetivamente declarada.
2. Seleção manual prevalece sobre IP; sem IP, cidade/UF manual e GPS opcional somente por clique.
3. Catálogo indisponível não simula resultados: busca manual permanece disponível; estados vazios acionam ajuda contextual.
4. Nenhum telefone privado, endereço residencial, IP bruto ou coordenada em logs, URL, analytics ou dados de descoberta.
5. Verificar teclado, seleção única, mobile 390px e desktop 1440px; CI e publicação rastreáveis pelo SHA.
