## Why

We want to introduce a Codex-style floating agent status/progress panel (sub-panel) next to the right-sidebar toggle button in Kanna. This panel will provide a quick, high-level overview of:
1. **Progress**: The agent's active execution checklist (Todos).
2. **Environment**: Git/workspace status including changes count, current branch, local project selection, and commit actions.
3. **Sources**: Files referenced/harvested by the agent during the task.

When the right sidebar is toggled open, this floating popover should automatically close to save screen estate and prevent overlapping. The "Progress" and "Sources" sections in the panel must be collapsible.

## What Changes

- **Right Sidebar Integration**: Update `ChatPage` state to track whether the progress popover is open. Ensure that toggling or opening the right sidebar sets the progress popover visibility to false.
- **Navbar Toggle Button**: Add a list/checks button (`lucide:ListChecks`) next to the right-sidebar toggle in the top-right header action group.
- **Floating Progress Popover**: Implement a modern, glassmorphic floating popover component (`AgentProgressPopover`) that displays:
  - **Progress section** (collapsible): Lists active todos dynamically read from `state.latestToolIds.TodoWrite`.
  - **Environment section**: Shows changes count, local path, active branch name, and commit/push shortcut.
  - **Sources section** (collapsible): Shows files/sources referenced.

## Capabilities

### Modified Capabilities
- `agent-orchestration`: Integrate progress monitoring, workspace environment stats, and referenced sources visibility into a toggleable floating panel.

## Impact

- **`apps/client/src/client/components/chat-ui/ChatNavbar.tsx`**: Add the new sub-panel toggle button and invoke the toggle handler.
- **`apps/client/src/client/app/ChatPage/index.tsx`**: Manage state for the floating popover and render it relative to the navbar action buttons.
- **`apps/client/src/client/components/chat-ui/AgentProgressPopover.tsx`**: Implement the layout, styling, collapse/expand states, and click-outside close handlers.
