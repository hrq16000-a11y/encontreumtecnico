# LP2 — Tema TanStack preservado

Origem visual: https://encontreumtecnico-tanstack.vercel.app/
Destino oficial: https://encontreumtecnico.vercel.app/

## Regra de isolamento
- Manter a home e rotas atuais inalteradas.
- Criar namespace /lp2 e subrotas /lp2/galeria, /lp2/cadastro.
- CSS, componentes e assets com escopo próprio, sem alterar estilos globais.
- Não migrar ou sobrescrever dados, autenticação, políticas, SEO, pagamentos ou cadastros nesta etapa.
- Não alterar DNS nem publicar produção antes de validação de preview.
- Evitar duplicação SEO: LP2 experimental com noindex até decisão editorial.

## Referência de design
Hero azul-marinho em gradiente, títulos brancos e turquesa, busca horizontal, cards claros de especialidades, etapas de atendimento, amostra de profissionais, CTA de cadastro e FAQ. Preservar responsividade, acessibilidade e hierarquia visual.

## Rodadas
1. Identificar origem e destino, criar branch isolada, registrar escopo.
2. Obter componentes e assets originais (preferir código-fonte ao redesenho), implementar namespace isolado.
3. Integrar galeria/cadastro com adaptadores seguros, sem alterar backend existente.
4. Executar build e verificações de rotas, revisar preview e publicar somente após aprovação.

## Critérios de aceite
- / e rotas oficiais continuam idênticas.
- /lp2, /lp2/galeria, /lp2/cadastro renderizam sem vazamento de CSS.
- Links internos da LP2 permanecem no namespace.
- Nenhum segredo, dado privado ou contato é exposto.
- Rollback por reversão de commit/PR, sem DNS.

Status: especificação registrada; implementação e deploy ainda não realizados.
