## 1. Navbar Toggle Trigger Button

- [ ] 1.1 Import `ListChecks` or a relevant checklist icon in `apps/client/src/client/components/chat-ui/ChatNavbar.tsx`.
- [ ] 1.2 Add `onToggleProgressPopover` prop and a button next to the right-sidebar toggle button to trigger it.

## 2. Floating Popover Component

- [ ] 2.1 Create the component `apps/client/src/client/components/chat-ui/AgentProgressPopover.tsx`.
- [ ] 2.2 Implement collapsible sections for **Progress** (active todos) and **Sources** (referenced files) using state.
- [ ] 2.3 Implement the **Environment** section with:
  - Changes indicator: calls `onToggleGitPanel` to focus Git changes.
  - Local path/project selector.
  - Active branch name selector: allows branch checkout or opens list.
  - Commit or push button: opens commit panel or triggers branch sync.
- [ ] 2.4 Use click-outside listener to close the popover.

## 3. Integration & Sync Logic

- [ ] 3.1 In `apps/client/src/client/app/ChatPage/index.tsx`, manage popover open state (`progressPopoverOpen`).
- [ ] 3.2 Add sync logic: if right sidebar becomes visible (`rightPanel !== "hidden"`), set `progressPopoverOpen` to `false`.
- [ ] 3.3 Render `<AgentProgressPopover>` absolute-positioned next to the navbar header actions when open.

## 4. Verification

- [ ] 4.1 Verify that clicking the navbar button toggles the popover.
- [ ] 4.2 Verify that opening the right-sidebar closes the popover.
- [ ] 4.3 Verify that clicking "Changes" or "Commit or push" in the Environment section navigates to/opens the Git panel.
