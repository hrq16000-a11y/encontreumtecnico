# WordPress → Supabase EUT — carga privada validada (08/11/2026)

## Origem e integridade
- SQL exportado pelo phpMyAdmin/MariaDB 10.11.19 em 08/11/2026 às 20h01.
- Nome do banco de origem: `encontre_wp_aishs` (prefixo WordPress `kaH92q9_`).
- SHA-256 do arquivo fonte: `675126ddf6b5c2bee385b516aa597073795a69300d0331939c7ec4292eba3aa3`.
- Origem permanece inalterada. **O dump SQL contém dados privados: nunca versionar, publicar ou expor através de URLs.**

## Destino
- Supabase exclusivo `pqtzhctvjbfcunmrvxne`.
- Esquema isolado `eut_migration`, fora da API pública.
- 8 tabelas de staging, todas com RLS e sem permissões de schema para `anon` e `authenticated`.
- Fonte `wordpress_20261108`, com SHA-256 e totais esperados registrados em `eut_migration.sources`.

## Registros efetivamente carregados
| Tabela de staging | Confirmado |
|---|---:|
| `legacy_accounts` | 912 |
| `legacy_directory` | 654 (384 técnicos/candidates, 270 contratantes/employers) |
| `legacy_jobs` | 20 |
| `legacy_media` | 434 (referências, não bytes de imagem) |
| `legacy_terms` | 60 |
| `legacy_taxonomy` | 60 |
| `legacy_term_relationships` | 1.162 |

Verificações:
- 654 de 654 perfis possuem usuário de origem vinculado ao staging, 0 órfãos.
- 654 perfis em `pending_review`; 0 perfis ativados/publicados no novo app.
- 912 contas em `unclaimed`; 0 contas vinculadas a `auth.users`.
- 0 e-mails de usuário em branco e 0 e-mails duplicados no staging.
- 1 conta administrativa WordPress histórica — **não** convertida em permissão administrativa Supabase.
- `public.profiles`, `public.technicians`, `public.service_requests` e `auth.users` permanecem vazias na conferência.
- Origem também tem conteúdo legado e localizações fora do Brasil; filtrar antes de tornar pública uma galeria.

## Restrições que precisam permanecer
1. Jamais importar senhas WordPress, tokens de sessão ou chaves de configuração do dump.
2. Login no app novo via Google/Supabase Auth. Reivindicação de conta legada requer comprovação de titularidade, associação por identidade verificada e prevenção de takeover; não habilitar automaticamente por simples correspondência de e-mail.
3. Revisão humana/administrativa antes de liberar perfis legados; preservar o número de telefone privado e disponibilizar contato apenas em fluxo autenticado/autorizado.
4. Contatos dos grupos de WhatsApp permanecem em conciliação separada, não se tornam contas ou perfis públicos sem consentimento e comprovação.
5. Integrar com Lovable/TanStack em etapas e seguir `AGENTS.md`; não sobrescrever migrations públicas, não duplicar Auth e não mudar domínio/DNS.
6. O banco contém referências de 434 anexos, mas os arquivos binários ainda dependem do ZIP de mídia e da conciliação de caminho/hashes.
7. Não executar merge/publicação até autenticação, reivindicação, busca, solicitações e RLS serem validadas com casos reais.

## Próximas etapas objetivas
- Implementar fluxos privados de reivindicação de perfil e aprovação no painel após Google Auth.
- Conciliar as 434 referências com o ZIP de mídia, sem exibir 404.
- Criar visão/consulta aprovada para a galeria, nunca expor staging bruto.
- Testar ponta a ponta cadastros, busca, solicitações e permissão de contatos.
