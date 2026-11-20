# Encontre um Técnico — contrato operacional estruturado (micro-rodada)

Status: **proposta em código, sem implantação no Supabase oficial nem publicação**.
Base de desenvolvimento: `main` após a PR #360 (`eed3ce74`).

## O que entra nesta rodada

| Campo | Tipo / limites | Onde é editado | O que o visitante recebe |
|---|---|---|---|
| Equipamentos | 8 códigos fechados (multímetro, notebook, ferramentas etc.) | Técnico/admin | Rótulos, sem serial/patrimônio |
| Locomoção / viagens | meio de transporte em lista fechada e `can_travel` | Técnico/admin | Meio de transporte e declaração de viagem |
| Disponibilidade | períodos: comercial, noite, madrugada, fim de semana, feriados | Técnico/admin | Períodos escolhidos, sem promessa de plantão |
| Tempo estimado | minutos entre 15 e 1.440 para comercial e outros períodos | Técnico/admin | Tempo **declarado**, sujeito a confirmação |
| Municípios sem/com taxa | códigos IBGE, subconjunto das 5 cidades já associadas à cobertura | Técnico/admin | Somente municípios conhecidos e nomes do catálogo |
| Quilometragem | km gratuitos, limite de faixa, centavos por km até/após limite | Técnico/admin | Valores declarados do deslocamento, distintos dos preços da plataforma |

Nenhum campo é obrigatório; valores ausentes são `null`/lista vazia. O editor não aceita telefones,
links, documentos, dados pessoais livres nem localizações exatas. A distância declarada não é GPS.
O controle de equipamentos é uma declaração do profissional, não verificação independente.

## Contrato e integrações

1. Persistência isolada: `eut_profile_ops.technician_operations` com FK para `public.technicians(id)`;
   não muda o cadastro canônico, as tabelas de compra, o preço de contato nem o status.
2. Edição própria e administrativa convergem para a mesma RPC, com autorização do servidor;
   o administrador deve informar motivo de 8 a 400 caracteres, com log antes/depois.
3. Salvamento usa versão `updated_at` e, após resposta positiva, **releitura** privada com
   comparação integral dos campos; não repete requisição automaticamente em incerteza.
4. Página pública consulta a RPC somente após a elegibilidade canônica do profissional.
   Uma projeção enumerada não contém nome, contatos, identidade, status ou endereço;
   também verifica códigos da cobertura. Se a RPC ainda não existe, a seção é omitida.
5. Painel técnico acrescenta aba “Atendimento e deslocamento” para cadastros aprovados.
   Painel administrativo oferece o mesmo editor a registros canônicos; não modifica fichas
   históricas não vinculadas a uma conta técnica. Fluxo do cliente continua consumindo o
   perfil público e não recebe contato pelo novo endpoint.

## Gates antes de qualquer implantação

- CI de typescript, build e testes do catálogo, perfil público e navegação.
- Workflow `eut-operations-profile-ephemeral.yml` com PostgreSQL local de dados fictícios,
  verificando dono, administrador, anônimo, auditoria, replay, cidades e dois suspensos.
- Revisão por responsável do Supabase de permissões, `SECURITY DEFINER`, `search_path`,
  preflight de funções/tipos existentes e plano de rollback; testes autenticados numa
  branch/ambiente de homologação com ficha técnica consentida.
- Com gates verdes, solicitação **específica** de autorização para SQL oficial, merge
  e eventual deploy; uma coisa não autoriza automaticamente a outra.

**Rollback proposto (somente após aprovação administrativa):** retirar as três wrappers
`public.eut_*technician_operations*` adicionadas, funções do schema interno e, se houver
necessidade comprovada, tabela operacional depois de preservar um backup dos dados novos.
Nunca apagar uma ficha existente ou modificar os dois suspensos como parte de rollback.

## O que NÃO foi incluído

- Nenhum OTP, arquivo de identidade, CNH, ASO, documentação privada ou redes sociais.
- Nenhuma alteração de RLS de tabelas existentes, liberações de contato ou tarifação de
  R$ 9,99/R$ 29,99; os valores por km são **informativos** e não cobráveis pelo portal.
- Nenhuma mudança no ranqueamento, reputação, SLA contratual, funil financeiro ou estoque
  de documentos. Esses recursos precisam de contratos e consentimentos separados.
