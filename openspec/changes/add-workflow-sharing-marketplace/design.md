## Overview

The marketplace layer separates workflow ownership from workflow distribution. Private workflows remain visible only to their owner. Users can share specific workflows by ID, and official/global workflows can be published through governed approval.

## Visibility States

Suggested visibility:

- `private_user`
- `shared_by_id`
- `official_global`
- `marketplace_public`
- `deprecated`

MVP for this change can implement `shared_by_id` and official publish governance first.

## Sharing by ID

Share-by-ID flow:

1. Owner creates a share link/token for a workflow definition or version.
2. Recipient imports using the ID.
3. System displays workflow metadata, version, source owner, and manifest.
4. Recipient confirms import.
5. System creates an imported copy or a linked reference based on policy.

Default should favor imported copy for safety.

## Official/Global Publishing

Official publishing should require:

- owner submit request
- reviewer approve
- workflow validation pass
- version selected for global release
- audit event recorded

Official global workflows become visible in all users' catalogs.

## Marketplace Metadata

Workflow definitions/packs may include:

- category
- tags
- description
- author
- version
- compatibility
- required artifacts
- ratings/usage later

## Versioning and Project Pins

Projects always pin workflow versions. Importing or upgrading shared workflows must not mutate existing project pins without user action.

## Non-Goals

- Payment/revenue marketplace mechanics are future work.
- Enterprise organization-level permissions are future work.
