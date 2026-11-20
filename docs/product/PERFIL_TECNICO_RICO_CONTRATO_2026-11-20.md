# Encontre um Técnico — contrato de perfil rico, localização e dossiê profissional

**Decisão de produto de Henrique Rodrigues, 20/11/2026.** Complementa
[`CADASTRO_UNIFICADO_E_GESTAO_OPERACIONAL_2026-11-19.md`](./CADASTRO_UNIFICADO_E_GESTAO_OPERACIONAL_2026-11-19.md).
Este documento diferencia **objetivo**, **funcionalidade já existente** e **pendência**.
Não autoriza mudança de preço, SQL em produção ou compartilhamento de dados privados.

## Norte

O Encontre um Técnico deve unir a apresentação profissional rica (referência LinkedIn),
a descoberta por serviço e região (referências GetNinjas e Triider) e a autonomia
administrativa de um CMS (referência WordPress), adaptadas ao modelo de **acesso
controlado ao contato**, sem leilão ou avaliação pública inventada. Os dados
pertencem a **uma ficha canônica**: o técnico informa, o cliente vê a projeção
permitida, o proprietário administra e a busca indexa **somente o público**.

## Inventário real anterior a esta rodada

| Campo/recurso | Estado conferido em `main` e no esquema do Supabase dedicado |
|---|---|
| Nome, UF/cidade-base, especialidades e serviços | Formulário em três etapas; gravação por `eut_publish_my_technician` com releitura da ficha |
| Apresentação (`bio`) | Texto público até mil caracteres, sem dígitos ou contatos; edição técnica e administrativa já previstas |
| Foto/avatar | Upload com consentimento, bucket `eut-technician-avatars` **público**, limite atual **2 MiB**, uma foto por perfil |
| Cobertura | Até cinco municípios IBGE, incluindo base, e raio aproximado; RPC de gravação existente |
| Perfil público | Mostra apresentação, serviços, localidades e foto, sem telefone; SSR sanitizado |
| Equipamentos, veículo, horários, ETA/SLA e regras de quilometragem | **Não existem como colunas estruturadas** em `public.technicians` |
| Portfólio de cinco fotos públicas e vinte privadas | **Não implementado**; não confundir com bucket do avatar |
| Cofre documental e dossiê compartilhável | **Não implementados**; não há liberação automática por pagamento |

## Contrato por camada e visibilidade

| Informação | Técnico autenticado | Visitante / busca pública | Cliente com finalidade legítima | Proprietário |
|---|---|---|---|---|
| Nome comercial, biografia profissional, especialidades, serviços, cidade-base | Edita | Pode ver | Pode ver | Edita/audita |
| Foto/avatar e **até 5 fotos públicas de portfólio** (máximo 1 MiB cada) | Escolhe e remove | Somente aprovadas pelo titular e moderadas | Pode ver | Gerencia e audita |
| Ferramentas, equipamentos, notebook, conectividade, veículo e possibilidade de viagem | Declara/atualiza | Atributos profissionais optados para divulgação | Pode ver o que for permitido | Edita/audita |
| Município-base, cidades sem taxa, cidades com taxa, raio e faixas de km | Edita campos estruturados IBGE | Base, área atendida e **condições declaradas não vinculantes** | Detalhamento da estimativa conforme pedido | Edita/audita regras e exceções |
| Atendimento comercial, noturno, madrugada, feriados, plantão, ETA estimado por período | Declara por faixa e revisão | Disponibilidade **declarada**, não localização ou promessa de chegada | Pode confirmar no pedido; prazo contratual só após aceite do técnico | Edita/audita |
| Portfólio privado (**até 20 fotos**, máximo 1 MiB cada) e currículo detalhado | Faz upload consentido | Nunca | Somente conteúdo específico autorizado, com registro e prazo | Acesso justificado, auditado |
| Certificados técnicos, treinamentos, autorizações de acesso | Envia mediante finalidade | Somente indicador factual autorizado, nunca documentos brutos | Compartilhamento pontual autorizado | Gestão restrita, auditoria e remoção |
| CNH, identificação, documentos para portaria, ASO | **Não entra no perfil público**; eventual coleta apenas caso a caso | Nunca | Não ganha acesso por mera compra do contato; finalidade, autorização e expiração | Acesso excepcional por necessidade, sem índice público |
| Família, estado civil, filhos/dependentes, consumo de substâncias, saúde | **Fora do cadastro e da pontuação** | Nunca | Nunca por compra de contato | Não coletar para triagem comercial |

Dados familiares não demonstram capacidade de atendimento; informações sobre vícios/saúde
podem ser sensíveis e discriminatórias. Substituir esse interesse por **capacidade
operacional declarada**: plantão, deslocamento, requisitos do local, documentação
de segurança vigente. Não classificar técnicos por vida privada. Para ASO, quando
indispensável, tratar apenas comprovação de aptidão/validade minimizada e mediante
revisão específica, jamais divulgar conteúdo clínico.

## Campos operacionais a implementar de modo estruturado

1. **Recursos profissionais:** lista versionada de equipamentos/ferramentas,
   conectividade, meio de locomoção e capacidade de viagem. Sem exigir marca,
   placa, endereço ou patrimônio pessoal.
2. **Cobertura e deslocamento:** município IBGE base; municípios gratuitos;
   municípios sujeitos a taxa; valor monetário por km, franquia de km,
   faixas após franquia, unidade, exemplo de cálculo e data de atualização.
   Distinguir distância rodoviária estimada de raio em linha reta. Não calcular
   cobrança definitiva sem origem/destino e aceite do profissional.
3. **Janelas e SLA:** calendário de períodos (comercial, noturno, madrugada,
   fim de semana, feriados), tempo **estimado de resposta** e de **chegada**,
   disponibilidade instantânea opcional com expiração; nunca garantia a partir
   de presença on-line. Ex.: acionamento às 15h vs. às 3h tem janelas diferentes.
4. **Experiência verificável:** portfólio de serviços reais com descrição,
   data aproximada, categoria e município **sem endereço do cliente**;
   certificados com evidência e expiração; não inventar avaliações.
5. **Mídias:** avatar separado de portfólio; até cinco imagens públicas e vinte
   privadas por técnico, **cada arquivo final até 1 MiB**; formatos verificados,
   otimização no cliente, remoção de EXIF/GPS, checagem no backend, exclusão
   auditável, contagem transacional e prevenção de arquivos órfãos.
6. **Dossiê sob solicitação:** cliente informa finalidade antes de pedir,
   técnico seleciona o conteúdo, sistema concede acesso individual temporário,
   expira/revoga, audita download e permite ao titular retirar o documento.
   Bucket privado, URL assinada curta e autorização/RLS no servidor.

Cada campo opcional deve ter `não informado`/`não atende`/`atende sob consulta`
sem assumir resposta positiva. O técnico nunca deve ser obrigado a expor patrimônio
ou dados pessoais para ser habilitado. Campos operacionais podem ser moderados
pelo proprietário sem conceder autoaprovação administrativa.

## Jornada integrada

1. **Cadastro curto:** identidade, município-base, serviços, apresentação opcional.
   Salvar no servidor, reler e recuperar a mesma ficha; foto e demais etapas
   aparecem como convites, não impedimentos ocultos.
2. **Enriquecer:** adicionar foto, ferramentas, capacidade de deslocamento,
   zonas/taxas, horários, portfólio e comprovantes em abas conectadas, com
   prévia pública e opção `não informar`.
3. **Busca e seleção:** filtro por serviço/cidade; sinais factuais (foto,
   portfólio, disponibilidade declarada, deslocamento) sem expor contato,
   endereço ou documentos. O portal não inventa distância, chegada ou qualidade.
4. **Solicitação:** o cliente informa serviço/local aproximado/urgência,
   compara condições declaradas, decide se quer contato e recebe o histórico
   de consentimentos pertinentes. Releitura sempre atualizada da ficha.
5. **Administração:** ficha 360° única para editar todos os campos permitidos,
   moderação de mídia, regras de visibilidade, gestão de campos opcionais,
   auditoria, histórico, revogação e resposta a incidentes. Poder operacional
   pelo painel **sem editor SQL irrestrito** no navegador.

## Produto comercial: decisão ainda necessária, sem alterar cobrança atual

Hipótese do proprietário: manter preços de referência **R$ 9,99 / R$ 29,99**
e variar a **quantidade de contatos liberáveis** conforme a riqueza de informações
profissionais. Um perfil rico poderia exigir apenas uma tentativa, enquanto um
perfil escasso poderia dar direito a novas opções. Isso é **proposta**, não regra
ativada: o contrato vigente limita a liberação e o pagamento ainda está em
integração. Antes de implantar, definir se a liberação adicional é gratuita ou
constitui novo produto, transparência pré-pagamento, prazo, reembolso e
auditoria de cada contato. **Completude não prova competência ou comparecimento**;
não prometer conclusão do serviço nem penalizar o profissional por documentos
privados/ausência de foto. Critérios devem ser objetivos e administráveis.

## Etapas pequenas e gates de aceite

| Etapa | Entrega | Gate real |
|---|---|---|
| **R1 — esta PR** | Guia de enriquecimento no painel técnico; tópicos de apresentação editáveis e persistidos pelo fluxo já existente; checklist privado; cobertura relida após salvar | Vitest, build, TypeScript, CI; **não** se declara E2E de titular sem sessão real |
| R2 | Esquema/contratos para recursos profissionais, disponibilidade e deslocamento; RPC de leitura/escrita do titular e RPC administrativa auditada | SQL revisado, RLS, roles, dados sintéticos, readback técnico/admin, sem migração automática |
| R3 | Editor técnico/admin, projeção pública sanitizada e filtros por condições declaradas | Fluxos 390/1440, validação real, sem contato/documento no SSR |
| R4 | Bucket de portfólio público e privado; limites, consentimento, moderação e exclusão | Provas upload 1 MiB, contagem 5/20, IDOR/RLS, EXIF, tipos, erro/retry |
| R5 | Dossiê sob solicitação e política comercial configurável no admin | Titular autoriza, cliente autorizado vê somente escopo, expiração/revogação auditadas, cobrança não simulada |

Nenhuma etapa afrouxa RLS, reativa os dois suspensos, migra dados ou libera
telefone privado. A adoção deve ser gradual, sem impedir o cadastro básico.
O checklist de R1 é **incentivo privado ao preenchimento**, não score público
nem fator de ranking ou precificação.

### Critérios concretos da R1

- Botões incluem apenas um **título vazio** para o titular escrever: experiência,
  ferramentas, deslocamento, horários. Não inventam dados nem admitem contatos.
- A bio continua validada pela mesma regra do técnico, administrador e SSR;
  gravação por RPC e releitura da ficha permanecem no fluxo existente.
- O guia usa nome/cidade/serviços/bio/foto/cobertura existentes; não lê telefone
  nem tenta calcular um índice de qualidade.
- Após salvar cobertura, o cliente lê a própria linha do banco e compara
  cidades e raio antes de afirmar sucesso; erros não repetem automaticamente
  a gravação e não expõem mensagens SQL.
- Ações de guia navegam diretamente à edição, foto e cobertura; não alteram
  status, regras de publicação ou dados de outros titulares.
