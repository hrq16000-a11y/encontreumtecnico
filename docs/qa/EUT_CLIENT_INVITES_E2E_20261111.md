# EUT — Homologação E2E de convites e gestão de clientes (QA autorizado)
Data: 2026-11-11. Não executar sobre contas reais.

## Pré-condições obrigatórias
- Duas identidades de QA controladas por seus titulares e explicitamente autorizadas:
  uma destinada ao papel `tecnico` e outra a `cliente`.
- Cada identidade com e-mail confirmado, sem conta legado WordPress, sem papel ativo,
  sem bloqueios e sem cadastro profissional prévio. Não usar conta administrativa.
- Administrador autorizado entra com a própria sessão, sem compartilhamento de tokens.
- Preferir ambiente de homologação com banco isolado. Não usar o banco produtivo para
  fixtures, simular expiração ou alterar relógio sem autorização específica.
- Registrar apenas IDs técnicos e resultados **mascarados** na evidência, nunca tokens,
  e-mails completos, telefones, convites reais ou cookies de sessão.

## Cenários de aceite por identidade (manuais, nenhum executado até haver QA)
1. Abrir `/admin/tecnicos`, criar convite do técnico com justificativa >= 8
   caracteres; confirmar que surge como pendente e há evento de auditoria.
   O site não deve enviar e-mail automaticamente.
2. Copiar o texto de convite; somente o titular do e-mail confirmado faz login
   em `/entrar`. Sem aceite dos termos, o botão fica desabilitado.
   Com termos, aceita o convite; testar acesso a `/area-tecnico`, sem publicar perfil.
3. Repetir com cliente usando `/admin/clientes`; verificar papel `cliente`
   após aceite e acesso a `/area-cliente`, sem compartilhar solicitações.
4. Tentar emitir novamente enquanto ainda pendente para o mesmo e-mail; exigir
   recusa sem criar nova linha ou evento de aceitação.
5. Criar e revogar convite de QA separado antes do aceite; titular não deve
   conseguir aceitá-lo. Revogação deve registrar auditoria e não afetar papéis.
6. Expiração: usar **somente** relógio/fixture de ambiente de testes ou transação
   `ROLLBACK` como já homologado. Após 72h, convite expirado não pode ser aceito.
7. Confirmar que visitante anônimo e técnico/cliente comuns não podem consultar
   o painel administrativo nem invocar RPCs de criação/revogação.
8. Recarregar, navegar, trocar de aba e voltar: o painel deve manter permissões
   corretas e não revelar endereço, contato ou senha.
9. Conferir que `/admin/clientes` exibe totais vindos do banco, e que o histórico
   separado pagina 20 eventos, aceita filtros e não retorna detalhes de pedidos.
10. Conferir idempotência, auditoria e preservação das contas anteriores. A
    remoção de identidades de QA, se necessária, exige procedimento aprovado
    do responsável; não executar exclusão automática.

## Evidência exigida para marcar aprovado
- Resultado HTTP autorizado e não autorizado com IDs de requisição (sem PII).
- Tela autenticada do administrador e duas telas finais dos destinatários QA.
- Eventos de auditoria correspondentes (somente IDs e tipo de evento).
- Contagens antes/depois e ausência de mudanças em identidades fora de QA.
- Build, TypeScript, gates de contas e segurança verdes, 200/404 das rotas
  relevantes e sessão encerrada após os testes.

## Estado nesta rodada
- Identidades de QA autorizadas **não foram encontradas** no inventário.
- Testes positivos de login/aceite permanecem **não executados**.
- Nenhum convite real ou identidade foi criado. A verificação negativa de grants
  e o teste de compilação da nova consulta administrativa usam transações seguras.
