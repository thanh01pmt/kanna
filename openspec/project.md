# Kanna

## About
A beautiful web UI for Claude Code built with React, TypeScript, and Bun/pnpm.

---

## Architecture Rules
1. **Monorepo Architecture (Planned)**: Structured with apps under `apps/` and packages under `packages/` using pnpm workspaces.
2. **Design Tokens & System**: Styles must adhere to `DESIGN.md` tokens using TailwindCSS.

---

## AI Agent Change Flow

Before implementing any non-trivial change:
1. Read this file and relevant `.ai/` files.
2. Run: `openspec list` and `openspec list --specs`
3. Create proposal: `openspec/changes/{change-id}/proposal.md`
4. Get approval, then implement tasks.
5. Verify: `npm run build` + `openspec validate --strict`
6. Archive: `openspec archive {change-id} --yes`
7. Post-archive: check `doc/` for stale content + run `npm run sync:context`

**Slash commands (Antigravity workflows)**:
- `/proposal` — scaffold a new OpenSpec change
- `/apply` — implement an approved proposal
- `/archive` — archive a deployed change (includes doc/ check)

---

## AI Context File Index

| File | Purpose | When to Read |
|---|---|---|
| `.ai/ARCHITECTURE.md` | System architecture and data flow | Before touching core logic |
| `.ai/CONVENTIONS.md` | File naming, import aliases | Before creating new files |
| `.ai/GUARDRAILS.md` | Do/Don't rules, checklists | Before committing any change |
| `.ai/STACK.md` | Package versions and constraints | Before adding dependencies |
| `openspec/specs/` | Capability specs | Before proposing system changes |

---

## doc/ Update Policy
> **When archiving any OpenSpec change**, scan `doc/` for content that may be stale due to the archived change. Update them before the next dev session.

---

## Platform Context Sync
All platform-specific AI rule files (`.cursor/`, `.windsurfrules`, `.agents/`, `.github/copilot-instructions.md`) are **auto-generated**.

To regenerate:
```bash
npm run sync:context
```
