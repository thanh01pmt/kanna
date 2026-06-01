# Tasks: Real-time Workflow Engine Synchronization

## 1. Backend Real-time Subscription support
- [x] 1.1 Add `subscribeToProjectWorkflow` to the `WorkflowRuntimeStore` interface in `packages/server/src/workflow-runtime-store.ts`.
- [x] 1.2 Implement `subscribeToProjectWorkflow` in `InMemoryWorkflowRuntimeStore` (as a no-op or simple mock listener) and `SupabaseWorkflowRuntimeStore` using `@supabase/supabase-js` realtime channel `postgres_changes`.
- [x] 1.3 Update `packages/server/src/ws-router.ts` to manage active project subscriptions dynamically via `syncProjectWorkflowSubscriptions` when clients subscribe/unsubscribe or disconnect.

## 2. Client Real-time Synchronisation Verification
- [x] 2.1 Verify `apps/client/src/client/app/ChatPage/index.tsx` correctly handles `project-workflow` snapshot messages via `state.socket.subscribe`.
- [x] 2.2 Verify that updates to the projection state cause `WorkflowTrackerPanel` to re-render without errors.

## 3. Verification & Auditing
- [x] 3.1 Test subscription triggering by running a mock tool run or mutating Supabase directly.
- [x] 3.2 Run typechecks and builds to verify codebase stability.
- [x] 3.3 Run `openspec validate --strict` to ensure compliance.
