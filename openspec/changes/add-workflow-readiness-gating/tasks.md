## 1. Readiness Model
- [x] 1.1 Extend workflow manifest input declarations for file, directory, and glob input types.
- [x] 1.2 Add readiness evaluator for project-registered workflows.
- [x] 1.3 Require accepted `source_of_truth` or `reviewed_ok` state for required inputs.

## 2. Stale Detection
- [x] 2.1 Record input artifact version/checksum metadata for workflow outputs.
- [x] 2.2 Detect when input versions/checksums are newer than recorded output inputs.
- [x] 2.3 Mark affected workflows/outputs as `needs_review` or `maybe_stale`.

## 3. Autonomy Policy
- [x] 3.1 Add settings representation for review autonomy levels.
- [x] 3.2 Apply conservative manual-review behavior by default.
- [x] 3.3 Allow higher-trust policies to auto-approve source-of-truth or impact decisions within configured scope.

## 4. UI
- [x] 4.1 Group registered workflows in the Start panel by ready, blocked, running, needs review, and repairable states.
- [x] 4.2 Show missing or unreviewed input reasons for blocked workflows.
- [x] 4.3 Show stale/review reasons when inputs changed after outputs were produced.

## 5. Verification
- [x] 5.1 Add tests for file, directory, and glob readiness evaluation.
- [x] 5.2 Add tests for source-of-truth gating and stale detection.
- [x] 5.3 Validate OpenSpec and run relevant type/tests.
