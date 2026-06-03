# Change: Add Pi Reasoning Logs

## Why
Users need visibility into Pi Agent's internal reasoning and steps (the thoughts behind tool execution and text updates) to debug and follow progress effectively. Currently, only final results and standard tool calls are shown in the chat transcript.

## What Changes
- Add `assistant_thinking` to the `TranscriptEntry` and `HydratedTranscriptMessage` types in `@kanna/shared/types`.
- Extract `thinking_delta` events from the Pi agent SDK stream and translate them into `assistant_thinking` transcript entries on the backend.
- Update `parseTranscript` and the Kanna frontend `KannaTranscript` to process and render a dedicated `ThinkingMessage` collapsible block in the chat interface.

## Impact
- Specs: `agent-orchestration`
- Code:
  - `packages/shared/src/types.ts`
  - `packages/server/src/pi-sdk-app-server.ts`
  - `packages/server/src/workflow-runtime-store.ts`
  - `apps/client/src/client/lib/parseTranscript.ts`
  - `apps/client/src/client/app/KannaTranscript.tsx`
  - `apps/client/src/client/components/messages/types.ts`
  - `apps/client/src/client/components/messages/ThinkingMessage.tsx`
