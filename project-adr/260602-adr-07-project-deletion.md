# ADR 07: Project Deletion & Chat History Pruning

## Overview
Implemented a robust, two-step "Delete Project" interface inside Kanna's local projects dashboard (Project Hub) and sidebar navigation. This feature allows users to safely remove projects from Kanna's workspace, optionally prune all associated local chat logs/transcripts, and guarantees that deleted projects do not clutter the autodiscovered projects grid.

## Context & Problem Statement
Previously, Kanna only supported a basic "hide project" behavior via the sidebar's context menu. Removing a project from the workspace had two major shortcomings:
1. **Stale Autodiscovery Clutter**: When a project directory physically remained on the disk, Kanna's auto-discovery manager would pick it up again and display it on the Project Hub grid as an unopened/discovered project. This defeated the purpose of removing it from the interface.
2. **Chat History Accumulation**: Removing a project from the workspace kept all its chat logs/transcripts saved in the internal DB log files (`chatsLogPath`), resulting in unnecessary storage consumption and lingering "trash" data.

## Implementation Details

### 1. Unified Types & Command Expansion
- **File:** `packages/shared/src/types.ts`
  - Added `id?: string` to `LocalProjectSummary` so both "saved" and "discovered" projects are unified, allowing cards to trace their backend identifier.
- **File:** `packages/shared/src/protocol.ts`
  - Extended the client command schema:
    ```typescript
    | { type: "project.remove"; projectId?: string; localPath?: string; deleteHistory?: boolean }
    ```

### 2. Discovered Projects Alignment
- **File:** `packages/server/src/read-models.ts`
  - Updated `deriveLocalProjectsSnapshot` to construct a set of all explicitly deleted projects (`deletedAt` is set).
  - Automatically filters out folders from the `discoveredProjects` array if they match the deleted projects' path, preventing removed projects from appearing on the dashboard.
- **File:** `packages/server/src/event-store.ts`
  - Verified that Kanna handles re-adding/opening a deleted project safely: choosing an existing folder via the "Add Project" dialog appends a fresh `project_opened` event which restores the project ID and preserves its history cleanly.

### 3. Backend History Pruning
- **File:** `packages/server/src/ws-router.ts`
  - Handled the new `deleteHistory` parameter under the `"project.remove"` command case.
  - If a discovered project (which has no pre-saved `projectId` yet) is removed, the backend automatically calls `store.openProject(localPath)` first to register it, then immediately removes it.
  - If `deleteHistory` is `true`, it retrieves all chats belonging to the target `projectId` and calls `store.deleteChat(chat.id)` sequentially to mark them as deleted and permanently clean them up from all future snapshots.

### 4. Two-Step Safe UX Dialogue Flow
- **File:** `apps/client/src/client/app/useKannaState.ts`
  - Re-implemented `handleHideProject` as a sequential double-confirmation workflow:
    - **Step 1 (Remove confirmation)**: Asks the user if they want to remove the project from Kanna (confirming that local disk files are untouched).
    - **Step 2 (Pruning decision)**: Asks the user whether they want to **Keep History** or **Delete History**. If the project has no chat history (e.g. an unopened/discovered project), Kanna intelligently **bypasses Step 2** to keep the workflow extremely fast and smooth!
- **File:** `apps/client/src/client/components/LocalDev.tsx`
  - Upgraded the project cards to display a red trash can icon on hover (with a tooltip) for **all** projects, including discovered projects. Passes both `id` and `localPath` to the handler.
- **File:** `apps/client/src/client/app/LocalProjectsPage.tsx`
  - Connected context-derived `handleHideProject` down to the `LocalDev` component.

## UX Verification & Safety
- Full Monorepo TypeScript checks were run via `pnpm run check` and compiled without warning.
- Users can confidently clean up project workspaces while keeping control over their local source files and database size.
