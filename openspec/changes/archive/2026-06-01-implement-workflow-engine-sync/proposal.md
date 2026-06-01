# Change: Real-time Workflow Engine Synchronization

## Why
Currently, the Kanna Workflow Engine's state is stored in a Supabase backend and modified by Kanna Agent runs or tool calls. The client UI (Zustand store and `WorkflowTrackerPanel` in the Right Sidebar) does not update automatically when backend workflow events or node statuses change, requiring manual page refreshes or complex user action to fetch the latest projection. Establishing a real-time WebSocket connection to sync database-backed projections dynamically to the frontend will provide a seamless tracking experience.

## What Changes
- Implement a Postgres replication / Realtime listener on the Bun backend CLI server to listen to inserts/updates in `workflow_runs`, `workflow_nodes`, `workflow_events`, `artifacts`, and `artifact_versions` tables, and automatically broadcast updated projections.
- Manage subscriptions dynamically in `ws-router.ts` using a self-healing subscription sync tracker so we only establish active database channels when a client is subscribed to a project's workflow.
- Refine the client's existing `project-workflow` socket subscription in `ChatPage/index.tsx` to handle inbound snapshots reliably without manual refreshes.
- Ensure `WorkflowTrackerPanel` and related React components react properly to these real-time broadcast snapshots.

## Impact
- `packages/server/src/workflow-runtime-store.ts`: Add `subscribeToProjectWorkflow` capability to listen to Supabase Postgres changes for a project and call a callback on update.
- `packages/server/src/ws-router.ts`: Dynamically subscribe and unsubscribe to database updates based on active WebSocket subscriptions.
- `apps/client/src/client/app/ChatPage/index.tsx`: Verify the existing `project-workflow` snapshot message handling updates React state as intended.
- `packages/workflow-tracker/*`: Ensure the components accurately consume and reflect the live projection updates.
