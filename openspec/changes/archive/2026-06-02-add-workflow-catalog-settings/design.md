## Overview

Move workflow import out of project runtime panels and into Settings as a user-scoped catalog. A workflow definition becomes a reusable asset owned by a user or published as an official global workflow. Projects will later register specific workflow versions from this catalog.

## Data Model

Extend or migrate `workflow_definitions`:

- `owner_user_id`: owner of private/user workflows.
- `visibility`: `private_user`, `official_global`, or future `shared_by_id`.
- `slug`, `name`, `description`.
- `created_at`, `updated_at`.

Extend `workflow_versions`:

- `version`.
- `status`: `draft`, `published`, `deprecated`, `archived`.
- `source_markdown`.
- `manifest_jsonb`.
- `created_by`, `published_at`.

The current single global slug uniqueness should be revisited for SaaS. A practical MVP can keep slug uniqueness if user identity is not fully wired yet, but the schema and service boundary should be prepared for owner-scoped uniqueness.

## Import Flow

1. User opens Settings > Workflows.
2. User selects or pastes a Markdown workflow definition.
3. Server parses YAML frontmatter and body.
4. Frontmatter is treated as the declared contract.
5. Existing extractor may add `inferred` artifacts/dependencies if the frontmatter is incomplete.
6. UI shows review state:
   - declared metadata
   - inferred additions requiring approval
   - warnings for body references to undeclared artifacts
   - errors for missing required fields
7. User publishes a version.

## Manifest Contract

The manifest should support:

- `name`, `version`, `description`
- `entrypoint`, `role`
- `inputs`
- `outputs`
- `artifacts`
- `flow`
- `execution`

Body Markdown remains the agent instruction. Frontmatter is the contract.

## Visibility

MVP visibility:

- `private_user`: visible to the creating user.
- `official_global`: visible to all users, controlled by the system owner.

Future:

- `shared_by_id`: user A can share a workflow ID for user B to import.

## Non-Goals

- Project registration is handled by `add-project-workflow-registration`.
- Readiness gating is handled by `add-workflow-readiness-gating`.
- Full workflow pack marketplace is future work.
