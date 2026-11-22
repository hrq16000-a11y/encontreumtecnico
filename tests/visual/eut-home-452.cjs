'use strict';
// QA-only Playwright: renders the real PR #452 Home, never a cloned HTML mock.
// No external requests, no production data, no backend SQL and no deployment.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const source = 'e60aedcc6aed5389690c3d51dd49ebec5722b65d';
const base = process.env.EUT_QA_BASE_URL || 'http://127.0.0.1:4318';
const output = path.resolve('artifacts/eut-home-452-visual');
fs.mkdirSync(output, { recursive: true });
const findings = [];
const screenshots = [];
const failedRequests = [];
const steps = [];
let currentPage = null;

function log(width, scenario, outcome, reason = '') {
  findings.push({ width, scenario, outcome, reason });
  console.log((outcome === 'PASS' ? 'PASS' : 'FAIL') + ' [' + width + '] ' + scenario + (reason ? ': ' + reason : ''));
}
async function shot(page, width, label, section = null) {
  const file = path.join(output, width + '-' + label + '.png');
  if (section) await section.screenshot({ path: file, timeout: 20000 });
  else await page.screenshot({ path: file, fullPage: false });
  screenshots.push(path.basename(file));
}
async function localOnly(context) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.port === '4318') {
      await route.continue();
    } else {
      failedRequests.push({ host: url.hostname, type: route.request().resourceType() });
      await route.abort('blockedbyclient');
    }
  });
}
function checkHorizontal(page) {
  return page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
}
async function launchPage(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    locale: 'pt-BR', reducedMotion: 'reduce',
    serviceWorkers: 'block', acceptDownloads: false,
  });
  await localOnly(context);
  const page = await context.newPage();
  currentPage = page;
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { name: /Precisou\?/i }).waitFor({ timeout: 30000 });
  await page.getByRole('dialog', { name: 'Aviso de cookies' }).waitFor({ timeout: 15000 });
  return { context, page };
}
async function runWidth(browser, width) {
  let opened;
  try {
    // 1: Home real, SSR/hidratacao e buscas sem overflow em duas resolucoes
    opened = await launchPage(browser, width);
    const { page, context } = opened;
    const specialty = page.locator('#busca-especialidade');
    const city = page.locator('#busca-cidade');
    await specialty.waitFor();
    assert.equal(await city.count(), 1);
    const dims = await checkHorizontal(page);
    assert.ok(dims.scrollWidth <= dims.viewport + 2,
      'Overflow horizontal: ' + JSON.stringify(dims));
    if (width === 390) {
      const a = await specialty.boundingBox(), b = await city.boundingBox();
      assert.ok(a && b && b.y > a.y + 15, 'Campos nao empilhados no mobile');
    }
    await shot(page, width, '01-home-entrada');
    log(width, 'Home e formulario responsivo', 'PASS', JSON.stringify(dims));

    // 2: negacao via interface — popup nao pode surgir nem consumir seen key
    await page.clock.install();
    await page.getByRole('button', { name: 'Rejeitar', exact: true }).click();
    await page.clock.fastForward(12500);
    const promo = page.locator('aside[aria-label="Convite para profissionais participarem da comunidade"], aside[aria-label="Campanha publicitária aprovada"]');
    assert.equal(await promo.count(), 0, 'Popup sem publicidade');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('eut-community-invite-home-v1')), null);
    await shot(page, width, '02-rejeicao');
    log(width, 'Recusa e ausencia do popup', 'PASS');
    await context.close();

    // 3: nova sessao, aceite, pop-up nao modal, geometria e revogacao pela UI
    const accepted = await launchPage(browser, width);
    opened = accepted;
    const q = accepted.page;
    await q.clock.install();
    await q.getByRole('button', { name: 'Aceitar todos', exact: true }).click();
    await q.getByRole('dialog', { name: 'Aviso de cookies' }).waitFor({ state: 'detached' });
    await q.clock.fastForward(12500);
    const float = q.locator('aside[aria-label="Convite para profissionais participarem da comunidade"], aside[aria-label="Campanha publicitária aprovada"]');
    await float.waitFor({ state: 'visible', timeout: 12000 });
    const rect = await float.boundingBox();
    assert.ok(rect && rect.width > 0 && rect.x >= -1 && rect.x + rect.width <= width + 1,
      'Popup transborda viewport: ' + JSON.stringify(rect));
    assert.ok(await q.getByRole('button', { name: 'Dispensar convite da comunidade' }).count() === 1 ||
      await q.getByRole('button', { name: 'Dispensar campanha' }).count() === 1,
      'Botao de fechar invisivel');
    await shot(q, width, '03-aceite-popup');
    log(width, 'Aceite, popup e largura', 'PASS', JSON.stringify(rect));

    // Persistencia/privacidade: reabrir preferencia e desligar publicidade de verdade.
    await q.evaluate(() => window.dispatchEvent(new Event('eut-open-cookie-preferences')));
    await q.getByRole('dialog', { name: 'Aviso de cookies' }).waitFor({ state: 'visible' });
    await q.getByRole('checkbox', { name: /Publicidade \(AdSense e campanhas aprovadas\)/ }).uncheck();
    await q.getByRole('button', { name: 'Salvar minhas preferências' }).click();
    await float.waitFor({ state: 'detached', timeout: 7000 });
    assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('eut-cookie-consent') || '{}').advertising), false);
    await shot(q, width, '04-revogacao');
    log(width, 'Revogacao via preferencias', 'PASS');

    // 4: prova social da Home, mesma implementacao do diretorio, sem dados artificiais.
    const proof = q.locator('section#perfis-reais');
    await proof.scrollIntoViewIfNeeded();
    await proof.getByRole('heading', { name: 'Conheça técnicos com perfis públicos reais' }).waitFor();
    await q.waitForTimeout(2500);
    assert.equal(await proof.getByText(/5 estrelas|depoimento verificado|tecnicos online agora/i).count(), 0);
    assert.ok((await proof.textContent()).includes('A publicação de um perfil não representa certificação técnica'));
    const links = await proof.locator('a[aria-label^="Ver perfil público de "]').count();
    await shot(q, width, '05-prova-social', proof);
    log(width, 'Componente real de prova social sem indicadores falsos', 'PASS',
      links ? links + ' perfis renderizados' : 'fallback/ausencia em ambiente sem backend; conteudo real nao comprovado');
    if (!links) steps.push({ width, note: 'PROVA SOCIAL COM PERFIS REAIS NO-GO: backend de producao isolado, sem lista real' });
    await accepted.context.close();
  } catch (err) {
    log(width, 'Execucao Chromium', 'FAIL', err && err.message ? err.message : String(err));
    if (opened?.page && !opened.page.isClosed()) {
      try { await shot(opened.page, width, 'FALHA'); } catch {}
      await opened.context.close().catch(() => {});
    }
    steps.push({ width, error: String(err && err.stack ? err.stack : err) });
  }
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    for (const width of [390, 1440]) await runWidth(browser, width);
  } catch (e) {
    steps.push({ fatal: String(e && e.stack ? e.stack : e) });
    console.error(e);
  } finally {
    await browser?.close().catch(() => {});
    const summary = {
      source, testRunner: 'Chromium + localhost + original React/TanStack code',
      productionAccess: false, screenshots, findings,
      blockedExternalRequestCount: failedRequests.length,
      blockedExternalHostnames: [...new Set(failedRequests.map(x => x.host))],
      limitations: steps,
    };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(summary, null, 2));
    const fails = findings.filter(x => x.outcome === 'FAIL').length;
    console.log('Visual QA outcomes', findings.length, 'failed', fails,
      'screenshots', screenshots.length,
      'source', source, 'EXTERNAL NETWORK BLOCKED');
    // Require both widths and each consent transition, not a build-only success.
    if (fails || findings.length < 10 || steps.some(x => x.error || x.fatal)) process.exitCode = 1;
  }
})();
