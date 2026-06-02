## 1. Schema Definition
- [x] 1.1 Add `zod` to `@kanna/shared` and define `ArtifactDefinitionSchema`, `ArtifactDependencyRuleSchema`, and `WorkflowManifestSchema` in `workflow-schema.ts`.

## 2. Static Extractor Script
- [x] 2.1 Create a utility/script capable of parsing Markdown files (lessons, prompts) to locate specific anchors or metadata blocks.
- [x] 2.2 Transform extracted data into instances of `ArtifactDefinition` and assemble them into a `WorkflowManifest`.

## 3. Human Approval UI
- [x] 3.1 Build an `InfoCard` or `DiffFileCard` UI in the frontend to display the proposed `WorkflowManifest`.
- [x] 3.2 Implement a "Publish" action to save the Immutable Workflow Version into the database after user review.
