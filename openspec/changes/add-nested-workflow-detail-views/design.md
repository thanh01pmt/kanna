## Overview

The user should see the main project flow first. Nested workflow internals should be available on demand by clicking into a workflow node.

## Views

1. Main Flow
   - Shows project-level sequence/graph such as `A -> B -> C`.
   - Shows each workflow status, produced artifacts, blockers, and review state.

2. Workflow Detail
   - Shows internal sub-flow for a selected workflow, such as `A1 -> A2 -> A3`.
   - Shows nested task/step/artifact nodes.
   - Provides breadcrumb navigation back to Main Flow.

## Navigation

- Click workflow node in Main Flow -> open detail view for that node.
- Click breadcrumb -> return to parent/main view.
- Preserve selected view per project where practical.

## Projection Requirements

Projection should expose:

- stable node ID
- parent node ID
- workflow definition/registration reference when applicable
- status/count summary
- artifact summary
- breadcrumb path

## Non-Goals

- This change does not implement graph inference or scheduling.
- This change does not create new nested runtime semantics; it displays the existing/projected structure more clearly.
