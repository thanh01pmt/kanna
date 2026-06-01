# AI Agent Guardrails

## ❌ Do NOT
1. Edit platform rule files directly (`.cursor/`, `.windsurfrules`, `.agents/rules/`, `.github/`). They are auto-generated. Edit the source files and run `npm run sync:context`.

## ✅ Always
1. Use the OpenSpec workflow for architectural changes.
2. Verify build output after restructuring.

## 🗃️ On Archiving an OpenSpec Change
After running `openspec archive <change-id> --yes`:
1. **Check `doc/`** for stale content.
2. **Re-sync platform files** — run `npm run sync:context`.
