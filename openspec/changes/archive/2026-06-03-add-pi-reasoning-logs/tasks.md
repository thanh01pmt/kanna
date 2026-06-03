## 1. Type Definitions & Backend Updates
- [x] Update `packages/shared/src/types.ts` to include `AssistantThinkingEntry` type and add it to `TranscriptEntry` and `HydratedTranscriptMessage` unions.
- [x] Modify `packages/server/src/pi-sdk-app-server.ts` to capture `thinking_delta` events and push `assistant_thinking` entries.
- [x] Modify `packages/server/src/workflow-runtime-store.ts` to support `assistant_thinking` in `workflowPayloadFromTranscriptEntry` for both Supabase and InMemory stores.

## 2. Frontend Parsers & Renderers
- [x] Modify `apps/client/src/client/lib/parseTranscript.ts` to handle `assistant_thinking` entries.
- [x] Modify `apps/client/src/client/components/messages/types.ts` to export `ProcessedThinkingMessage`.
- [x] Create `apps/client/src/client/components/messages/ThinkingMessage.tsx` component to render reasoning process.
- [x] Update `apps/client/src/client/app/KannaTranscript.tsx` to handle, group, and render `assistant_thinking` entries.
