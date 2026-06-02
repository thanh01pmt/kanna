## Overview

Introduce a registry layer between workflow catalog and workflow runs. The catalog answers "what workflows exist for this user?" The project registry answers "which workflow versions are installed/enabled in this project?"

## Data Model

Add `project_workflows`:

- `id`
- `project_id`
- `workflow_definition_id`
- `workflow_version_id`
- `enabled`
- `is_default_entrypoint`
- `alias`
- `order_index`
- `settings_jsonb`
- `created_at`, `updated_at`

Constraints:

- A project should not register the same workflow definition/version twice.
- At most one enabled project workflow should have `is_default_entrypoint = true` per project.
- Registration pins `workflow_version_id`.

## Register Flow

1. User opens Project Workflows.
2. UI shows available catalog workflows.
3. User ticks one or more workflows.
4. User selects versions or accepts latest published version.
5. User designates one default entrypoint if any selected workflow is initial-capable.
6. Server creates `project_workflows` rows.

## Start Workflow Behavior

The Start panel must list project-registered workflows only. It should not list every catalog workflow. Starting a workflow validates:

- the project workflow registration exists
- it is enabled
- the pinned version exists and is published

The run should reference the pinned `workflow_version_id`.

## Upgrade Behavior

Project registrations remain pinned. If a newer version exists in the catalog, UI displays update availability and user can explicitly upgrade that project registration.

## Non-Goals

- Deep readiness gating is handled separately.
- Workflow packs are future work, though this schema can support pack registration later.
