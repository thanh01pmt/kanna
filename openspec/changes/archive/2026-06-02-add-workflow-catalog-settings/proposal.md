## Why

Workflow import currently behaves like a project-local action in the UI, but the stored definitions are effectively shared across projects. We need a Settings-level workflow catalog so users can import, review, version, and manage workflow definitions before registering them into projects.

## What Changes

- Add a Settings workflow catalog surface for importing Markdown workflow definitions.
- Treat YAML frontmatter as the primary workflow contract, with extractor output as a fallback/inferred supplement.
- Store workflow definitions with owner/visibility metadata so SaaS users see their own workflows plus official global workflows.
- Preserve workflow version history and make project usage pin to a specific version in later registration work.
- Add import validation for missing required metadata and body references to undeclared artifacts.

## Capabilities

### New Capabilities
- `workflow-catalog`: Covers Settings-level workflow import, review, publishing, ownership, visibility, and version history.

### Modified Capabilities
- `workflow-engine`: Workflow publishing continues to create immutable versions, but catalog ownership and Settings-first import become the expected source of workflow definitions.

## Impact

- Database schema: `workflow_definitions`, `workflow_versions` metadata for owner, visibility, and lifecycle status.
- Client Settings UI: new catalog page/list, import/review/publish flow, version history display.
- Shared workflow schema: frontmatter/manifest fields for inputs, outputs, artifacts, entrypoint/role, flow, and execution hints.
- Server commands/API: list catalog entries, import/validate Markdown, publish version, list versions.
