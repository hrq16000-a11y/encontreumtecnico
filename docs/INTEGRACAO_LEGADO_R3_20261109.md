# Encontre um Técnico — rodada 3/5: recuperação real de cadastros WordPress (09/11/2026)

## Implementação entregue
- No Supabase externo `pqtzhctvjbfcunmrvxne`, a migração `eut_verified_legacy_claims_and_review_r3_20261109` instalou `public.legacy_profile_claims` com RLS; não editamos `supabase/migrations` gerenciado pelo Lovable.
- A rota `/reivindicar-cadastro` permite que um técnico com identidade Google solicite o vínculo informando **ID WordPress**, sem expor contatos do registro antigo.
- A rota `/area-tecnico` ganhou link para recuperação do cadastro anterior.
- O painel `/admin` ganhou a lista `LegacyClaimReview`, com estados `pendente`, `em_analise`, `rejeitado` e `vinculado`, notas e decisão registrada.
- Usuários autenticados só leem os próprios pedidos; administradores podem visualizar e revisar. Nenhum cliente pode alterar a identidade do solicitante, aprovar seu pedido ou apagar registros.
- Função de vinculação executada por **gatilho privado**, não RPC público. Somente revisão do administrador pode dispará-la, e requer justificativa de 20+ caracteres, conta Google verificada, perfil antigo do tipo `candidate` e exclusão dos 20 registros demonstrativos.
- A transição `vinculado` grava `eut_migration.legacy_accounts.auth_user_id`, registra `claim_status='verified'`, marca a revisão histórica como `verified`, cria/garante papel `tecnico` e só cria o cadastro em `public.technicians` como `pendente`.
- Mesmo após comprovação, o perfil **não entra na busca pública** sem aprovação posterior no painel normal e revisão dos dados de cidade/especialidade. Se já existir perfil novo para essa conta, ele não é substituído.
- Esquema privado WordPress (912 contas, 384 técnicos, 270 contratantes) permanece intacto até que usuários reais reivindiquem seus registros. Não importar senhas nem permitir contato não autenticado.

## Conferências executadas
- Criação da migração: success.
- RLS: enabled; `anon` não tem SELECT; `authenticated` não pode DELETE nem editar `claimant_id`; não-admin sem sessão vê 0 registros.
- Função privilegiada `eut_migration.complete_legacy_claim`: indisponível para EXECUTE direto por `anon` e `authenticated`.
- Contagens antes de uso real: 0 claims; 654 registros históricos no índice protegido; 912 contas privadas; **0 usuários em Auth**.
- Preview Vercel da branch compilado com sucesso, mas os testes unitários e fluxo completo com uma conta Google/administrador real ainda não foram executados.
- Security Advisor mantém 4 avisos anteriores de funções `SECURITY DEFINER` acessíveis e 8 informações esperadas de staging RLS sem política; rever antes de abertura geral.

## Pontos de atenção
1. A referência numérica WordPress é apenas uma chave de busca, **não prova titularidade**; a decisão administrativa deve ter prova independente documentada sem expor documentos no banco.
2. Login Google só será validável de ponta a ponta quando a conta autorizada autenticar-se no projeto novo. O gatilho de administrador já está configurado; esta rodada não concedeu privilégios a nenhum usuário fictício.
3. Perfis de demonstração não podem ser vinculados. Verificar também localidade e categoria antes de aprovar.
4. Fotos reais não foram migradas para Supabase Storage; os 18 arquivos recuperados correspondem a demos. Não usar imagens de demonstração nos profissionais reais.
5. Manter `noindex` temporário no novo projeto e WordPress antigo em produção; nunca alterar DNS, domínio nem lançar a galeria antes dos testes finais.
6. Manter o layout clean existente sem mudanças visuais.
