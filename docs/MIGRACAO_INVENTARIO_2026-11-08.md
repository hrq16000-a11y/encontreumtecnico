# Migração segura — inventário verificável (08/11/2026)

## Fontes recuperadas (não publicar no GitHub)
- Export WordPress/WXR `encontreumtcnicoprecisodeumtcnico.WordPress.2026-11-07.xml`, 35,4 MB. **Não substitui MySQL completo**.
- Mídias `encontreumtecnico-midias-2026-11-07.zip`, 113,8 MB.
- Preparação `encontreumtecnico-preparacao-migracao.zip` (recuperado para auditoria).
- Conciliação privada `contatos-grupos-conciliados.csv` e ZIPs dos grupos WhatsApp (dados não foram versionados).
- Código legado de migração no repositório `hrq16000-a11y/Projeto-Encontre-um`, branch `feat/encontreumtecnico-migracao-vercel`. **Não sobrescrever as rotas do Lovable indiscriminadamente**.

## Dados conferidos localmente
| Indicador | Resultado |
| --- | ---: |
| Técnicos no pacote saneado | 384 |
| IDs distintos | 384 |
| Slugs distintos | 384 |
| Status de origem | 384 `publish` |
| Status de destino | 384 `pendente_revisao` |
| Fotos principais recuperadas e verificadas SHA-256 | 18 |
| Referências de mídia ausentes | 240 |
| Contatos de grupos conciliados | 133 |
| Possíveis correspondências com WordPress | 17 |
| Contatos ainda pendentes de verificação | 116 |
| Contatos de grupo com login Google verificado | 0 |
| Perfis/contatos liberados para publicação pelo pacote | **0** |

`scripts/auditar_pacote_eut.py` apenas lê arquivos locais e emite totais; não escreve dados pessoais nem conecta a banco externo.

## Supabase atual (projeto pqtzhctvjbfcunmrvxne)
- Existem 3 tabelas de aplicação: `user_roles`, `profiles`, `technicians`; todas com RLS ativa, contagens consultadas = 0.
- Há 2 migrações registradas, provavelmente geradas pelo Lovable; não aplicar o esquema SQL antigo de maneira automática.
- Ainda não existem tabelas de clientes, triagem, solicitações ou importação legada.
- Security Advisor retornou avisos sobre as funções `public.choose_account_type` e `public.has_role` como `SECURITY DEFINER` acessíveis a usuários autenticados. Revisar chamadas/grants antes de abrir o app; não remover indiscriminadamente a dependência das políticas RLS.

## Regra de importação
1. Carregar **somente em staging privado** após esquema e autorização definidos, com IDs WordPress imutáveis para deduplicação; nunca transformar contatos de grupos em técnicos públicos automaticamente.
2. Assumir `pendente_revisao` até comprovação de titularidade do perfil, consentimento e login novo.
3. Preservar origem funcional WordPress, contas, histórico e DNS; não sobrescrever banco original.
4. Não usar nomes, telefones, e-mails, credenciais, fotos ou históricos pessoais em commits públicos, previews e logs.
5. Para paridade 100%, precisamos do **MySQL completo da hospedagem**, e não apenas XML: usuário/roles, metadados Careerfy/JobSearch, mensagens, vínculo técnico-cliente, consentimento e autenticação.

## Próxima micro-rodada
Implementar staging privado compatível com as tabelas que o Lovable já criou; testar OAuth Google, cadastro e aprovação de um técnico novo; depois reconciliar origens e migrar dados de forma incremental. Somente após testes E2E, SEO e restauração considerar corte de domínio. **Sem DNS até isso acontecer.**
