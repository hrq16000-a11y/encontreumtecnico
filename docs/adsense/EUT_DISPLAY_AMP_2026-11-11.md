# Encontre um Técnico — Display AdSense + AMP (11/11/2026)

## Conta e bloco autorizados
- Publicador: `ca-pub-3762170279587706`
- Display slot: `9606076941`
- Responsivo: `data-ad-format="auto"`, `data-full-width-responsive="true"`.
- A `main` já possui `google-adsense-account` no `<head>` e `/ads.txt`; esta implementação **não duplica** a verificação.

## Páginas normais (TanStack/React)
O código não deve ser colado como `<script>` em cada componente React. Em vez disso:
1. `src/components/adsense-loader.tsx` carrega o script oficial do AdSense uma só vez, no `<head>`, **após consentimento explícito** para publicidade e apenas se `VITE_EUT_ADSENSE_DISPLAY_9606076941=true` (flag independente; também exige o AdSense existente habilitado).
2. `AdSenseDisplaySlot` insere dentro de `<body>` o único `<ins class="adsbygoogle">` do bloco acima, entre `<main>` e `<footer>`, com uma chamada `adsbygoogle.push({})` por montagem. A navegação SPA preserva formulário e evita push duplicado no mesmo nó. Não forçar refresh de anúncios.
3. Rotas públicas permitidas: `/`, `/tecnicos`, `/servicos`, `/como-funciona`, `/faq`, `/galeria`. Rotas privadas, admin, login, cadastro, contato, pagamento e perfis sensíveis ficam excluídos.
4. Um visitante pode retirar o consentimento; novos blocos deixam de ser renderizados. A retirada de consentimento não apaga cookies ou acessos já realizados pelo provedor.

**Importante:** `VITE_EUT_ADSENSE_DISPLAY_9606076941` permanece **desativado por padrão**. Para servir anúncios é necessário aprovação do site no Google AdSense, conformidade do CMP/consentimento/LGPD, validação de CSP e publicação homologada. A presença do código **não** garante anúncios preenchidos nem receitas.

## AMP
**Estado atual:** a árvore atual do repositório não contém páginas HTML AMP, seus respectivos links `rel="amphtml"` ou mecanismo AMP dedicado. O portal TanStack não é AMP. Injetar `<amp-ad>` dentro das páginas React criaria markup inválido. **Nenhuma página AMP foi publicada ou apresentada como indexável.**

### Snippets a inserir somente em uma futura página AMP válida

No `<head>` do documento AMP, exatamente uma vez:

```html
<script async custom-element="amp-ad" src="https://cdn.ampproject.org/v0/amp-ad-0.1.js"></script>
```

Dentro do `<body>` da página AMP, somente num espaço com consentimento válido:

```html
<amp-ad width="100vw" height="320"
  type="adsense"
  data-ad-client="ca-pub-3762170279587706"
  data-ad-slot="9606076941"
  data-auto-format="rspv"
  data-full-width="">
  <div overflow=""></div>
</amp-ad>
```

**Atenção:** para tornar esse bloco operacional, a página precisa ser um documento AMP completo e validado, com script AMP runtime, boilerplate, meta viewport, `rel="canonical"` para conteúdo equivalente, `rel="amphtml"` na versão normal e controle de consentimento AMP (por exemplo, `amp-consent`). Não cadastrar versões AMP apenas para anúncios nem duplicar páginas de baixa qualidade. Validar em [AMP Test](https://search.google.com/test/amp) antes de publicar.

## Homologação e rollout
- Gate Vitest de publicador, slot, consentimento, flag, rotas proibidas, push único e remoção na troca de rota.
- Gate build TanStack e TypeScript.
- Conferir aprovação do site no AdSense e política de consentimento real antes de habilitar a flag.
- Em Preview privado com anúncio desativado: observar ausência de requests ao Google. Em Preview com configuração liberada, testar em mobile/desktop consentimento aceito/recusado, navegação SPA, JS console, CSP, Core Web Vitals e espaço responsivo; alguns bloqueadores de anúncios causarão ausência normal.
- Não fazer merge/publicação sem gates e autorização. Nenhum DNS, Supabase, WordPress, 20 demos, Lovable ou checkout é alterado.

## Compatibilidade com a main (revisão isolada)
A main já publica o componente `AdSensePublicUnit` com slot `5328066374` na home. Sua função exportada `hasAdvertisingConsent` e a configuração existente `VITE_EUT_ADSENSE_SERVING` são preservadas. O novo slot `9606076941` é complementar e exige `VITE_EUT_ADSENSE_DISPLAY_9606076941=true`, **desativado por padrão**. Não alterar a configuração do bloco existente nem afirmar que não há AdSense ativo. Sem ativação, SQL, DNS, merge ou deploy nesta PR.
