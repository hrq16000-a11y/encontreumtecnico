"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classify } = require("./eut-pr-queue-guardian.cjs");

const pr = () => ({
  draft: false,
  base: { ref: "main", repo: { full_name: "owner/repo" } },
  head: { repo: { full_name: "owner/repo" } },
  labels: [{ name: "qa:approved" }, { name: "queue:automerge" }],
  mergeable: true,
});
const ok = [{ name: "ci", status: "completed", conclusion: "success" }];
const status = { total_count: 0, state: "pending" };

test("integra apenas PR interna aprovada com CI verde", () => {
  assert.equal(classify(pr(), ok, status), "PR pronta para integração segura");
});
test("nunca integra Draft", () => {
  assert.match(classify({ ...pr(), draft: true }, ok, status), /Draft/);
});
test("bloqueia sem QA ou autorização explícita", () => {
  assert.match(classify({ ...pr(), labels: [{ name: "queue:automerge" }] }, ok, status), /QA/);
  assert.match(classify({ ...pr(), labels: [{ name: "qa:approved" }] }, ok, status), /autorização/);
});
test("bloqueia fork, conflito e mudança de base", () => {
  assert.match(classify({ ...pr(), head: { repo: { full_name: "stranger/fork" } } }, ok, status), /Fork/);
  assert.match(classify({ ...pr(), mergeable: false }, ok, status), /Conflito/);
  assert.match(classify({ ...pr(), base: { ...pr().base, ref: "other" } }, ok, status), /Base/);
});
test("bloqueia CI ausente, incompleto ou falho", () => {
  assert.match(classify(pr(), [], status), /não encontrado/);
  assert.match(classify(pr(), [{ name: "ci", status: "in_progress" }], status), /pendente/);
  assert.match(classify(pr(), [{ name: "ci", status: "completed", conclusion: "failure" }], status), /reprovado/);
});
test("bloqueia outros checks e statuses vermelhos", () => {
  assert.match(classify(pr(), [...ok, { name: "security", status: "completed", conclusion: "failure" }], status), /check pendente/);
  assert.match(classify(pr(), ok, { total_count: 1, state: "failure" }), /legado/);
});
