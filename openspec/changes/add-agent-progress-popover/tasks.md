## 1. Navbar & Status Strip Toggles

- [ ] 1.1 Import `ListChecks` and `Activity` icons in `apps/client/src/client/components/chat-ui/ChatNavbar.tsx`.
- [ ] 1.2 Add `onToggleProgressPopover` and `onToggleDiagnosticsPanel` props to `ChatNavbar.tsx`, rendering buttons next to right-sidebar toggle.
- [ ] 1.3 Update `ChatStatusStrip.tsx` to accept `onToggleDiagnosticsPanel` and bind it to the "Tokens" chip `onClick` handler.

## 2. Floating Popover Diagnostics

- [ ] 2.1 Pass `messages` array or derived diagnostics to `<AgentProgressPopover>` in `apps/client/src/client/app/ChatPage/index.tsx`.
- [ ] 2.2 Add collapsible **Diagnostics** section or display cost, duration, and optimization tips in `<AgentProgressPopover>`.
- [ ] 2.3 Ensure click-outside close listener is robust.

## 3. Collapsible Turn Diagnostics in Transcript

- [ ] 3.1 Update `deriveChatDiagnostics` in `apps/client/src/client/lib/chatDiagnostics.ts` to support both database and hydrated transcript entry formats.
- [ ] 3.2 Update `ChatTranscriptViewport.tsx` and `KannaTranscript.tsx` to pass the full `messages` array down to `ResultMessage.tsx`.
- [ ] 3.3 Implement collapsible detailed turn-level diagnostics in `ResultMessage.tsx`.
  - Calculate diagnostics specifically for the current turn (messages from preceding user prompt to the result message).
  - Render a summary pill/badge with total duration, cost, tool call count, and tokens.
  - Expand to show detailed token breakdowns, tool call trajectory steps, and diagnostics tips.

## 4. Integration & Sync Logic

- [ ] 4.1 Manage popover open state (`progressPopoverOpen`) in `apps/client/src/client/app/ChatPage/index.tsx`.
- [ ] 4.2 Sync logic: closing popover when right sidebar is toggled or when click outside occurs.

## 5. Verification

- [ ] 5.1 Verify navbar buttons and status strip chips correctly toggle panels and popovers.
- [ ] 5.2 Verify turn-level diagnostics expand and collapse properly under Result messages.
- [ ] 5.3 Verify correct calculation of metrics using `deriveChatDiagnostics`.

