# Change: Add Workflow Import Pipeline

## Why
Currently, workflows are hard-coded. We need a way to statically extract workflow definitions from Markdown documents (like lesson files, prompts, and workflows) to dynamically build an immutable Workflow Manifest.

## What Changes
- Add Zod schemas for `ArtifactDefinition`, `ArtifactDependencyRule`, and `WorkflowManifest`.
- Create a Static Extractor script that parses Markdown files for expected artifacts and dependencies.
- Build a Human Approval UI (e.g., `InfoCard` or `DiffFileCard`) allowing users to review the extracted Manifest before it is published to the database.

## Impact
- Specs: `workflow-engine/spec.md`
- Code: `@kanna/shared/workflow-schema.ts`, a new extractor script, and UI review components.
