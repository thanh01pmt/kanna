# Change: Update Workflow Tracker Sidebar UI

## Why
The Workflow Tracker Panel currently functions with a single density mode and requires alignment with the core Kanna Design System. To ensure proper visual representation and screen real-estate usage, the UI must support variable density modes (Compact, Normal, Expanded) and match the application's aesthetic tokens.

## What Changes
- Add three Density Modes (Compact, Normal, Expanded) to the `WorkflowTrackerPanel` to allow flexible detail viewing.
- Update UI element color classes (`bg-card`, `bg-background`, `border-border`) in accordance with `DESIGN.md`.
- Enforce correct typography usage (Body for standard text, Roboto Mono for code/logs).
- Remove fake step counts and use accurate term indicators (`done`, `running`, `known next`, `horizon open`).

## Impact
- Specs: `openspec/changes/update-workflow-sidebar-ui/specs/workflow-engine/spec.md`
- Code: `packages/workflow-tracker/src/components/WorkflowTrackerPanel.tsx`, `apps/client/src/client/app/ChatPage/index.tsx`
