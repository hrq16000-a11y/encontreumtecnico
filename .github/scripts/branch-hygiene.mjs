import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const repo = process.env.GITHUB_REPOSITORY;
const statePath = process.env.BRANCH_HYGIENE_STATE ?? ".branch-hygiene-state/snapshot.json";
const outputDir = dirname(statePath);
if (!repo) throw new Error("GITHUB_REPOSITORY is required.");

function ghObjects(endpoint, jq) {
  const output = execFileSync("gh", ["api", "--paginate", "--jq", jq, endpoint], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  return output.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function readPrevious() {
  if (!existsSync(statePath)) return null;
  const value = JSON.parse(readFileSync(statePath, "utf8"));
  if (
    !value ||
    value.schema !== 1 ||
    !value.refs ||
    typeof value.refs !== "object" ||
    Array.isArray(value.refs) ||
    !Array.isArray(value.open_prs) ||
    (value.pendingExclusiveChecks !== undefined &&
      (!Array.isArray(value.pendingExclusiveChecks) ||
        !value.pendingExclusiveChecks.every((item) =>
          typeof item?.name === "string" && /^[0-9a-f]{40}$/.test(item?.sha)
        ))) ||
    (value.exclusiveProofs !== undefined &&
      (!value.exclusiveProofs ||
        typeof value.exclusiveProofs !== "object" ||
        Array.isArray(value.exclusiveProofs)))
  ) {
    throw new Error("Cached snapshot is malformed; refusing to classify refs.");
  }
  return value;
}

const branches = ghObjects(
  "repos/" + repo + "/branches?per_page=100",
  ".[] | {name: .name, sha: .commit.sha, protected: .protected}"
);
const prs = ghObjects(
  "repos/" + repo + "/pulls?state=open&per_page=100",
  ".[] | {number: .number, draft: .draft, head_ref: .head.ref, head_sha: .head.sha, base_ref: .base.ref}"
);
if (branches.length === 0) throw new Error("Branch inventory is empty; refusing to update the snapshot.");

const refs = Object.fromEntries(branches.map(({ name, sha, protected: isProtected }) =>
  [name, { sha, protected: Boolean(isProtected) }]
));
const openPrHeads = new Set(prs.map((pr) => pr.head_ref));
const openPrBases = new Set(prs.map((pr) => pr.base_ref));
const fixedProtected = new Set(["main", "gh-pages", "lovable-sync"]);
const protectedPrefixes = ["backup/", "archive/", "release/", "qa/", "integration/"];
const isProtected = (name, value) =>
  value.protected ||
  fixedProtected.has(name) ||
  protectedPrefixes.some((prefix) => name.startsWith(prefix)) ||
  openPrHeads.has(name) ||
  openPrBases.has(name);

const previous = readPrevious();
const oldRefs = previous?.refs ?? {};
const currentNames = Object.keys(refs).sort();
const oldNames = Object.keys(oldRefs).sort();
const currentSet = new Set(currentNames);
const oldSet = new Set(oldNames);
const added = previous ? currentNames.filter((name) => !oldSet.has(name)) : [];
const missing = previous ? oldNames.filter((name) => !currentSet.has(name)) : [];
const moved = previous
  ? currentNames.filter((name) => oldSet.has(name) && oldRefs[name].sha !== refs[name].sha)
  : [];
const protectedNames = currentNames.filter((name) => isProtected(name, refs[name]));
const manualReview = previous
  ? currentNames.filter((name) => !isProtected(name, refs[name]) && !openPrHeads.has(name))
  : [];

if (!refs.main?.sha) throw new Error("Main is missing: classification blocked.");

// Keep previous evidence only for the same exact branch AND main SHAs.
// A changed main makes old evidence unverified, never deletion-eligible.
const exclusiveProofs = Object.fromEntries(
  Object.entries(previous?.exclusiveProofs ?? {}).filter(([name, proof]) =>
    proof?.branchSha === refs[name]?.sha &&
    proof?.mainSha === refs.main.sha &&
    (proof?.exclusiveCommits === "yes" || proof?.exclusiveCommits === "no")
  )
);

// Do not repeat historical audits. Only newly added, moved, or
// previously deferred refs can enter the bounded comparison queue.
const fresh = [...new Set([...added, ...moved])]
  .map((name) => ({ name, sha: refs[name].sha }));
const queued = [
  ...(previous?.pendingExclusiveChecks ?? []),
  ...fresh,
];
const waiting = [...new Map(queued.map((item) => [item.name, item])).values()]
  .filter(({ name, sha }) => refs[name]?.sha === sha && !isProtected(name, refs[name]));
const pendingExclusiveChecks = [];
let comparisonAttempts = 0;

for (const { name, sha } of waiting) {
  if (comparisonAttempts >= 10) {
    pendingExclusiveChecks.push({ name, sha });
    continue;
  }

  comparisonAttempts += 1;
  try {
    const [comparison] = ghObjects(
      `repos/${repo}/compare/${refs.main.sha}...${sha}`,
      "{ahead_by: .ahead_by, behind_by: .behind_by}"
    );

    if (
      !Number.isInteger(comparison?.ahead_by) ||
      !Number.isInteger(comparison?.behind_by)
    ) throw new Error("Incomplete comparison");

    exclusiveProofs[name] = {
      branchSha: sha,
      mainSha: refs.main.sha,
      exclusiveCommits: comparison.ahead_by > 0 ? "yes" : "no",
      aheadBy: comparison.ahead_by,
      behindBy: comparison.behind_by,
    };
  } catch {
    // Fail closed: unavailable evidence stays pending.
    pendingExclusiveChecks.push({ name, sha });
  }
}

const report = {
  mode: "dry-run",
  generatedAt: new Date().toISOString(),
  repository: repo,
  baselineReferenceCounts: { branches: 181, openPullRequests: 42, pendingItemsPreserved: 14 },
  baselineComparisonIsCountOnly: true,
  previousSnapshotAvailable: Boolean(previous),
  current: { branches: branches.length, openPullRequests: prs.length },
  deltasFromHistoricalCounts: {
    branches: branches.length - 181,
    openPullRequests: prs.length - 42,
  },
  inventoryDeltaFromPreviousSnapshot: previous
    ? { added, disappearedSinceSnapshot: missing, headMoved: moved }
    : { state: "first-observation", note: "No refs are classified on a cache miss." },
  protected: { count: protectedNames.length, names: protectedNames },
  manualReviewOnly: { count: manualReview.length, names: manualReview },
  exclusiveCommitEvidence: {
    comparedAgainstMain: refs.main.sha,
    checkedThisRun: comparisonAttempts,
    proofs: exclusiveProofs,
    queued: pendingExclusiveChecks.length,
    unlistedRefsAreUnverified: true,
  },
  cleanupEligibility: {
    authorized: false,
    candidates: [],
    unresolvedOriginalItems: 14,
    reason: "No nominal reconciliation or deletion authorization",
  },
  pendingItems: {
    originalCount: 14,
    action: "preserved; no closure or deletion is performed",
    note: "Unknown identifiers are not inferred or rewritten by this workflow.",
  },
  actionsPerformed: [],
  actionsAvailable: [],
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(statePath, JSON.stringify({
  schema: 1,
  capturedAt: report.generatedAt,
  refs,
  exclusiveProofs,
  pendingExclusiveChecks,
  open_prs: prs.map(({ number, draft, head_ref, head_sha, base_ref }) =>
    ({ number, draft, head_ref, head_sha, base_ref })),
}, null, 2) + "\n", "utf8");
writeFileSync(outputDir + "/report.json", JSON.stringify(report, null, 2) + "\n", "utf8");

const summary = [
  "# Branch Hygiene — dry-run",
  "",
  "- Branches: " + branches.length + " (historical reference 181; delta " + report.deltasFromHistoricalCounts.branches + ").",
  "- Open PRs: " + prs.length + " (historical reference 42; delta " + report.deltasFromHistoricalCounts.openPullRequests + ").",
  "- Protected refs: " + protectedNames.length + ".",
  "- Manual review only: " + manualReview.length + ".",
  "- Previous snapshot: " + (previous ? "available" : "missing; first observation only"),
  "- Original 14 pending items: preserved; their identifiers are not inferred.",
  "- Exclusive commit comparisons this run: " + comparisonAttempts + " (queued " + pendingExclusiveChecks.length + ").",
  "- Deletion eligibility: disabled, zero candidates.",
  "",
  "No branches, PRs, labels, or refs were changed or deleted. Manual-review entries are not deletion recommendations.",
].join("\n");
writeFileSync(outputDir + "/report.md", summary + "\n", "utf8");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n", "utf8");
process.stdout.write(summary + "\n");
