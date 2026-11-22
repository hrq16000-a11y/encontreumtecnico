'use strict';
// One-scenario targeted Chromium QA of original PR #452 + tiny mobile correction.
// No remote services, no invented profiles, no CI suite, no deploy.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('artifacts/eut-home-452-popup-390');
fs.mkdirSync(out, { recursive: true });
const local = process.env.EUT_QA_BASE_URL || 'http://127.0.0.1:4318';
const evidence = {
  source: 'e60aedcc6aed5389690c3d51dd49ebec5722b65d',
  viewport: { width: 390, height: 844 },
  scenario: 'Popup must never obstruct mobile Home search while search form visible',
  results: [], screenshots: [], blockedExternalRequests: 0,
};
let page, browser;
async function capture(name) {
  const filename = name + '.png';
  await page.screenshot({ path: path.join(out, filename), fullPage: false });
  evidence.screenshots.push(filename);
}
function record(name, value) {
  evidence.results.push({ check: name, status: 'PASS', ...value });
  console.log('PASS [390] ' + name + (value ? ' ' + JSON.stringify(value) : ''));
}
async function searchRect() {
  return page.evaluate(() => {
    const form = document.getElementById('busca-especialidade')?.closest('form');
    const r = form?.getBoundingClientRect();
    return r ? { top:r.top, bottom:r.bottom, left:r.left, right:r.right } : null;
  });
}
(async () => {
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({
      viewport: evidence.viewport, reducedMotion: 'reduce',
      locale: 'pt-BR', serviceWorkers: 'block', acceptDownloads: false,
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.port === '4318') return route.continue();
      evidence.blockedExternalRequests++;
      return route.abort('blockedbyclient');
    });
    page = await context.newPage();
    await page.goto(local, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { name: /Precisou\?/i }).waitFor({ timeout: 30000 });
    await page.locator('#busca-especialidade').waitFor();
    await page.clock.install();
    await page.getByRole('button', { name: 'Aceitar todos', exact: true }).click();
    await page.getByRole('dialog', { name:'Aviso de cookies' }).waitFor({ state:'detached' });
    const popup = page.locator('aside[aria-label="Convite para profissionais participarem da comunidade"], aside[aria-label="Campanha publicitária aprovada"]');
    const form = await searchRect();
    assert.ok(form && form.top < evidence.viewport.height && form.bottom > 0, 'Search form must be visible on initial mobile view');
    await page.clock.fastForward(12500);
    assert.equal(await popup.count(), 0, 'Invite must not cover visible mobile search after delay');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('eut-community-invite-home-v1')), null, 'Deferred invite must not consume session');
    const button = page.locator('#busca-cidade').locator('xpath=ancestor::form').locator('button[type="submit"]');
    const hit = await button.evaluate(el => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return { x,y,buttonVisible: r.top >= 0 && r.bottom <= innerHeight,
        uncovered: Boolean(top && (top === el || el.contains(top))),
        width: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth };
    });
    assert.ok(hit.buttonVisible && hit.uncovered, 'Search CTA is not visibly clickable: ' + JSON.stringify(hit));
    assert.ok(hit.width <= hit.viewport + 2, 'Horizontal overflow: ' + JSON.stringify(hit));
    await capture('01-busca-visivel-sem-popup');
    record('Busca clicavel apos 12,5s, sem popup e sem scroll horizontal', { form,hit });
    // Stay partially on the form: scroll should NOT trigger the popup yet.
    await page.evaluate(() => window.scrollBy(0, 40));
    await page.waitForTimeout(300);
    const partly = await searchRect();
    assert.ok(partly && partly.bottom > 0 && partly.top < innerHeight, 'Form should still be partially visible');
    assert.equal(await popup.count(), 0, 'Invite appeared during partial scroll over form');
    await capture('02-busca-parcial-sem-popup');
    record('Scroll parcial preserva Busca sem popup', { partly });
    // Move below the entire search. The postponed invitation can now appear once.
    await page.locator('#home-tecnico-cadastro').scrollIntoViewIfNeeded();
    const gone = await searchRect();
    assert.ok(gone && gone.bottom <= 0, 'Search still visible after navigating to next section: ' + JSON.stringify(gone));
    await popup.waitFor({ state:'visible',timeout:12000 });
    const overlay = await popup.boundingBox();
    assert.ok(overlay && overlay.x >= 0 && overlay.x + overlay.width <= 390, 'Popup outside viewport');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('eut-community-invite-home-v1')), '1');
    await capture('03-popup-so-apos-passar-busca');
    record('Popup aparece somente apos Busca sair da tela', { gone,overlay });
    // Verify dismissal and no reappearance in the same session.
    const close = page.getByRole('button', { name: /Dispensar convite da comunidade|Dispensar campanha/ });
    await close.click();
    await popup.waitFor({ state: 'detached' });
    await page.evaluate(() => window.scrollBy(0, 350));
    await page.waitForTimeout(300);
    assert.equal(await popup.count(), 0);
    await capture('04-dispensado-sem-repeticao');
    record('Dispensar nao reaparece na mesma sessao', {});
  } catch (err) {
    const msg = err?.stack || String(err);
    console.error(msg);
    evidence.results.push({ check: 'QA 390',status:'FAIL',error:msg });
    if (page && !page.isClosed()) {try{await capture('FALHA-390')}catch{}}
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(()=>{});
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(evidence,null,2));
    console.log('QA_POPUP_390',JSON.stringify({pass:evidence.results.filter(x=>x.status==='PASS').length,fail:evidence.results.filter(x=>x.status==='FAIL').length,screenshots:evidence.screenshots,externalBlocked:evidence.blockedExternalRequests}));
    if(evidence.results.filter(x=>x.status==='PASS').length!==4)process.exitCode=1;
  }
})();
