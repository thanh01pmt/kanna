## 1. UI Density Modes
- [x] 1.1 Add a `densityMode` property (`"compact" | "normal" | "expanded"`) to the `WorkflowTrackerPanelProps`.
- [x] 1.2 Implement the `compact` mode logic in `WorkflowNodeRow` (hiding logs, artifacts, and nested metadata).
- [x] 1.3 Implement the `expanded` mode logic (forcing nested items open or showing extra details).
- [x] 1.4 Allow the parent app (in `ChatPage/index.tsx`) to pass the desired density mode.

## 2. Design System Alignment
- [x] 2.1 Audit and update background tokens in `WorkflowTrackerPanel.tsx` to strictly use `bg-card` and `bg-background`.
- [x] 2.2 Verify that all standard borders use `border-border`.
- [x] 2.3 Apply `font-mono` exclusively to logs, node types, statuses, and file paths.
- [x] 2.4 Verify exact vocabulary is used for progression state (`done`, `running`, `known next`, `horizon open`) instead of artificial counts.
