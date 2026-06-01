## 1. Artifact Action UI
- [x] 1.1 Add action buttons (`Rerun`, `Review downstream`, `Repair downstream`, `Regenerate`, `Invalidate`, `Accept as source of truth`) to the Artifact component in the Tracker.
- [x] 1.2 Display these actions only when `densityMode` is `expanded` or when hovering/clicking on the artifact in `normal` mode.
- [x] 1.3 Apply `DESIGN.md` rules: round pills (`rounded-full`) or tags (`rounded-md`) for these small action buttons.

## 2. Impact Resolution Logic
- [x] 2.1 Write server-side or store logic to compute the downstream dependency tree based on `artifact_impacts`.
- [x] 2.2 Create a function to determine all artifacts marked as `needs_repair` when a user selects "Repair downstream".

## 3. Bulk Repair Confirmation
- [x] 3.1 Implement a `DialogOverlay` and `DialogContent` with `z-index: 50` and `shadow-xl` to serve as a warning.
- [x] 3.2 Display the calculated list of downstream artifacts that will be impacted in the dialog.
- [x] 3.3 Trigger the actual repair logic only upon user confirmation.
