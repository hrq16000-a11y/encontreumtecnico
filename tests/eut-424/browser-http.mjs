// EUT #424 local QA-A/QA-B — blocked scaffold; no network until authorization.
// Existing GoTrue publishing/readback test from #429 must not be repeated.
import assert from 'node:assert/strict';
const expected = Object.freeze({
  qaA: 'GoTrue browser session + link only for published visible profile',
  public200: 'approved, consented, unblocked synthetic profile => HTTP 200',
  legacy301: 'valid legacy UUID => canonical slug HTTP 301',
  guarded404: 'blocked or unconsented synthetic profile => real HTTP 404',
  failure: 'failed DB/RPC is an error, never a false 404',
  leakage: 'no phone, JWT or private reason in public HTML',
  visual: 'Chromium 390/1440, keyboard and no horizontal overflow'
});
function assertLocal(raw, ports) {
  const url = new URL(raw);
  assert.equal(url.protocol, 'http:');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'remote host prohibited');
  assert(ports.includes(url.port), 'unexpected localhost port');
  assert(!url.username && !url.password, 'URL credentials forbidden');
  return url;
}
assert.equal(process.env.EUT_424_LOCAL_QA_APPROVED, 'true',
  'QA BLOCKED: separate authorization required');
assert.equal(process.env.EUT_424_ACTIVE_DEFINITIONS_VERIFIED, 'true',
  'QA BLOCKED: two active SQL definitions not yet available');
assert.equal(process.env.EUT_424_DATA_API_CONFIRMED, 'true',
  'QA BLOCKED: official Data API schema exposure unverified');
assert.equal(process.env.EUT_424_EGRESS_BLOCKED, 'true',
  'QA BLOCKED: network egress isolation unproven');
assertLocal(process.env.API_URL ?? '', ['54321']);
assertLocal(process.env.DB_URL ?? '', ['54322']);
assertLocal(process.env.APP_URL ?? '', ['3000','4173']);
assert(Object.keys(expected).length === 7);
throw new Error('QA BLOCKED: no HTTP/Chromium assertions implemented or approved');
