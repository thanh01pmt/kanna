## Why

We want to introduce a Codex-style floating agent status/progress panel (sub-panel) next to the right-sidebar toggle button in Kanna, and enhance Kanna's chat diagnostics visibility. This provides a quick, high-level overview of:
1. **Progress**: The agent's active execution checklist (Todos).
2. **Environment**: Git/workspace status including changes count, current branch, local project selection, and commit actions.
3. **Sources**: Files referenced/harvested by the agent during the task.
4. **Diagnostics**: Real-time token usage, execution duration, and costs for the session and individual message turns.

When the right sidebar is toggled open, this floating popover should automatically close to save screen estate and prevent overlapping. The "Progress" and "Sources" sections in the panel must be collapsible. Collapsible turn-level diagnostics must also be integrated directly under results in the main chat transcript.

## What Changes

- **Right Sidebar Integration**: Update `ChatPage` state to track whether the progress popover is open. Ensure that toggling or opening the right sidebar sets the progress popover visibility to false.
- **Navbar Toggle Button**: Add a list/checks button (`lucide:ListChecks`) and a diagnostics button (`lucide:Activity`) next to the right-sidebar toggle in the top-right header action group.
- **Floating Progress Popover**: Implement a modern, glassmorphic floating popover component (`AgentProgressPopover`) that displays:
  - **Progress section** (collapsible): Lists active todos dynamically read from `state.latestToolIds.TodoWrite`.
  - **Environment section**: Shows changes count, local path, active branch name, and commit/push shortcut.
  - **Sources section** (collapsible): Shows files/sources referenced.
  - **Diagnostics stats**: Display session execution time, estimated cost, and optimization tips.
- **Collapsible Turn Diagnostics**: Add a collapsible detailed diagnostics pill/panel directly in `ResultMessage.tsx`. When expanded, it renders token breakdown, tool efficiency, and a mini-trajectory of tool steps.
- **Status Strip Integration**: Enable clicking the "Tokens" chip in `ChatStatusStrip.tsx` to toggle the Diagnostics panel in the right sidebar.

## Capabilities

### Modified Capabilities
- `agent-orchestration`: Integrate progress monitoring, workspace environment stats, referenced sources visibility, and turn-level diagnostics into a toggleable floating panel and transcript message views.

## Impact

- **`apps/client/src/client/components/chat-ui/ChatNavbar.tsx`**: Add the new sub-panel toggle buttons and invoke toggle handlers.
- **`apps/client/src/client/app/ChatPage/index.tsx`**: Manage state for the floating popover and right sidebar panel toggles.
- **`apps/client/src/client/components/chat-ui/AgentProgressPopover.tsx`**: Implement the layout, styling, collapse/expand states, and display session diagnostics.
- **`apps/client/src/client/components/messages/ResultMessage.tsx`**: Implement collapsible detailed turn-level diagnostics (tokens, cost, duration, steps, tips).
- **`apps/client/src/client/components/chat-ui/ChatStatusStrip.tsx`**: Allow clicking the Tokens chip to toggle the right-sidebar Diagnostics panel.
