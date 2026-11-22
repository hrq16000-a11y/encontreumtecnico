# Branch Hygiene v1.0

## Scope

This routine creates an incremental inventory and a human-review report. It is permanently dry-run: it has read-only GitHub permissions and contains no branch, PR, label, ref, or deployment mutation.

## Reference point

The prior inventory supplied for this project recorded 181 branches and 42 open PRs. The live read-only snapshot on 2026-11-22 found 188 branches and 40 open PRs before this hygiene PR was created. These counts are context only; they do not prove that any branch is obsolete.

The 14 original pending items remain unresolved and protected from cleanup decisions. Their identifiers are not reconstructed or associated with branch names from incomplete evidence. No branch is marked deletion-eligible without separate nominal reconciliation and explicit authorization. This routine does not close or delete them.

## Protected refs

Always protect GitHub-marked protected branches, \`main\`, \`gh-pages\`, \`lovable-sync\`, prefixes \`backup/\`, \`archive/\`, \`release/\`, \`qa/\`, and \`integration/\`, plus both the head and base branches of every open PR.

## Incremental state

The scheduled/manual workflow stores the last inventory in a GitHub Actions cache. It reports new refs, refs absent since the previous snapshot, and moved heads. If the cache is missing or invalid, it records a first observation and classifies nothing. Cache loss therefore reduces reporting detail; it never authorizes cleanup.

Exclusive-commit evidence is compared against the exact main SHA only for newly added, moved, or previously queued refs, up to 10 comparisons per run. Evidence is cached with both branch and main SHAs. Missing, failed, or stale evidence means unverified, not zero exclusive commits. A comparison with zero ahead commits does not establish merge provenance or permission to delete.

Branches without an open PR or protected classification are listed for manual review only. The report does not claim they are merged, redundant, or safe to remove. Proving that requires commit reachability, unique-commit review, release/deployment/workflow dependency checks, and confirmation that no pending project item depends on the ref.

## Acceptance and rollback

- Read-only permissions: \`contents: read\`, \`pull-requests: read\`.
- No deletion API or write token is present.
- The workflow runs weekly or by manual dispatch and uploads a 30-day report artifact.
- To stop inventorying, disable the workflow. To revert the proposal, close the Draft PR and remove the branch through a separately authorized operation.
- No workflow is dispatched as part of this PR preparation.
