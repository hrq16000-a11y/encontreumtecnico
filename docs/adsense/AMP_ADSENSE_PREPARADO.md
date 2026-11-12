# AdSense no Encontre um Técnico — AMP (preparação, NÃO ativado)

O portal atual é TanStack Start/React e suas páginas públicas são HTML convencional,
**não** documentos AMP. Não adicionar `amp-ad` ou a biblioteca AMP ao HTML normal:
isso não cria AMP válido e pode prejudicar o desempenho e a validação.

O bloco HTML convencional da conta `ca-pub-3762170279587706`, slot
`5328066374`, está implementado na Home com a opção de publicidade consentida.
O arquivo `public/ads.txt` continua a ser a fonte de autorização de vendedores.

Quando (e somente quando) existir uma página AMP realmente válida e testada pelo
validador AMP, o código informado para o seu `<head>` é:

```html
<script async custom-element="amp-ad" src="https://cdn.ampproject.org/v0/amp-ad-0.1.js"></script>
```

E para o corpo da página AMP, na posição aprovada de anúncio:

```html
<amp-ad width="100vw" height="320"
     type="adsense"
     data-ad-client="ca-pub-3762170279587706"
     data-ad-slot="5328066374"
     data-auto-format="mcrspv"
     data-full-width="">
  <div overflow=""></div>
</amp-ad>
```

Checklist futuro:
1. Construir um HTML AMP válido, com `amp`, runtime, boilerplate e metadados.
2. Ligar canonical da página AMP à página regular e `amphtml` da regular à AMP.
3. Validar sintaxe, acessibilidade, consentimento e políticas da rede.
4. Somente então publicar a rota AMP e testar a renderização de anúncios.
5. Não duplicar conteúdo sem canonical e não colocar formulários privados em AMP.

Referência do Google:
https://support.google.com/adsense/answer/9274230
