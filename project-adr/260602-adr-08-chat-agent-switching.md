# ADR 08: Dynamic In-Chat Agent & Model Switching

## Overview
Unlocked provider and model constraints for active chat sessions in Kanna. Users can now seamlessly switch between agent providers (Claude, Codex, Antigravity, Pi) and their respective model options right inside any ongoing chat conversation, without being forced to start a new chat session.

## Context & Problem Statement
Previously, Kanna locked the agent provider for a chat once it was initialized. If a chat was started with Claude, the user could never switch to Codex or another agent within that conversation. The UI footer dropdowns were disabled (`providerLocked` was set to `true`), and the backend's message routing logic strictly resolved the original chat provider (`resolveProvider` always returned `currentProvider` if set). 

This restricted user flexibility, forcing users to create entirely separate chats to compare agent reasoning capabilities or utilize specific specialized models (such as the Pi agent for local course generation workflows).

## Implementation Details

### 1. Client-Side Decoupling & Sync
- **File:** `apps/client/src/client/components/chat-ui/ChatInput.tsx`
  - Unlocked controls by setting `providerLocked` to `false` unconditionally.
  - Passed `null` instead of `activeProvider` to `getEffectiveComposerState` to prevent overriding the user's manual selections in the composer state.
  - Added a `useEffect` hook to dynamically sync the composer's provider with the chat's `activeProvider` when the active chat loads, ensuring the footer controls correctly reflect the current chat state but remain interactive.
- **File:** `apps/client/src/client/app/ChatPage/ChatInputDock.tsx`
  - Updated the prop typing of `activeProvider` to `AgentProvider | null` to support Antigravity and Pi alongside Claude and Codex.

### 2. Server-Side Dynamic Routing & Persistence
- **File:** `packages/server/src/agent.ts`
  - Refactored `resolveProvider` to prefer the user-specified provider from the client's message payload rather than locking to the chat's historically stored provider:
    ```typescript
    private resolveProvider(options: SendMessageOptions, currentProvider: AgentProvider | null) {
      return options.provider ?? currentProvider ?? "claude"
    }
    ```
  - Updated `startTurnForChat`'s persistence check. If the resolved provider is different from the currently saved chat provider, Kanna dynamically updates the chat's provider in the event store:
    ```typescript
    if (chat.provider !== args.provider) {
      await this.store.setChatProvider(args.chatId, args.provider)
      logSendToStartingProfile(args.profile, "start_turn.provider_set", {
        chatId: args.chatId,
        provider: args.provider,
      })
    }
    ```
  - This guarantees that switching an agent mid-chat correctly updates the chat session's persistent defaults for future messages.

## UX Verification & Safety
- **Compilation Check**: The monorepo has been verified with a TypeScript build check, compiling flawlessly with no warnings or type errors in the updated files.
- **Dynamic Transition**: Switching providers and model settings updates the UI immediately. When a new prompt is submitted, the backend dynamically initializes the new agent's run cycle (e.g. starting a Codex session or routing to Antigravity) safely.
