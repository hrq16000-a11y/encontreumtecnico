# Evidências de evolução — Encontre um Técnico
> Modelo operacional de PR. Sem SQL, migrations ou publicação acionados por este documento.

## Micro-rodada e rastreabilidade
- Objetivo e escopo mínimo:
- Issue / tarefa de origem:
- Ambiente: [ ] local [ ] CI [ ] preview [ ] produção (somente verificada)
- Etapa: [ ] planejamento [ ] desenvolvimento [ ] QA [ ] homologação [ ] publicação [ ] monitoramento [ ] saneamento
- Status: [ ] aberto [ ] em validação [ ] bloqueado [ ] pronto para publicar [ ] publicado [ ] concluído [ ] obsoleto
- Progresso documentado: __% (critérios medidos, não estimativa de publicação)
- Base `main` (SHA):
- HEAD candidato (SHA):
- HEAD validado + data:
- Versão/deployment real (se aplicável):

## Fato × intenção
- **Executado nesta PR:** (somente mudanças presentes no diff)
- **Apenas verificado:** (consulta, CI ou QA sem alteração)
- **Depende de validação manual:** (login, visual, homologação, aprovação)
- **Não alterar:** (limites explícitos do escopo)
- **Dependências externas / bloqueios:**

## Evidências — sem alegações não comprovadas
- Diff/commit:
- CI, jobs e run URLs:
- Preview/HTTP/QA reais (URL, data, viewport):
- Prints ou artefatos (URLs; ocultar dados privados):
- Sem evidência: escrever **NÃO VALIDADO**, nunca PASS por inferência.

## Conclusão e não regressão
- [ ] Escopo limitado ao tema da PR, sem perda de commits exclusivos
- [ ] HEAD e checks obrigatórios correspondem à versão candidata
- [ ] Critérios funcionais e de segurança aplicáveis atendidos
- [ ] Nenhum dado, segredo, contato privado ou funil afetado fora do escopo
- [ ] Publicação separada de merge: se não houve publicação, registrar **NÃO PUBLICADO**
- [ ] Decisão de merge humana e pós-merge conferida

## Limpeza de fila (somente se pertinente)
- Item/branch candidato:
- Prova de integração/substituição:
- Comparação de commits exclusivos:
- Dependências/checks pendentes:
- Autorização explícita e URL do encerramento externo:
- **Nenhuma exclusão automática** a partir deste checklist.

## Aceite específico Encontre um Técnico
- [ ] Não revelar telefone privado em SSR/HTML público, JSON-LD, sitemap, logs ou buscas.
- [ ] RLS e autorização administrativa verificadas por evidência de servidor; **CI verde sem gate RLS não equivale a RLS validado**.
- [ ] Cadastro, edição, arquivamento e restauração não alteram contatos suspensos nem dados reais sem operação autorizada e auditada.
- [ ] QA autenticado em 390/1440 registra sessão/rota/HEAD e resultados, **sem expor credenciais nem dados de pessoas**.
- [ ] Distinguir teste estático, CI, Vercel READY, QA HTTP e produção servida; merge não autoriza deploy automático.
- [ ] Migração WP/Guiafix e legado preservados; rótulo de origem não se torna distinção pública; nenhuma exclusão por nome `legacy` ou backup.
- [ ] Contato/consentimento/funil e elegibilidade dos técnicos preservados; não alterar preço ou pagamento por incidente.
- [ ] Sem mudanças de Supabase, migrations, RLS, DNS, contatos suspensos ou deployment fora da autorização específica.
