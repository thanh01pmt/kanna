## 1. Implementation
- [x] 1.1 Extend `packages/shared/src/protocol.ts` to include `settings.listSkills` and `settings.saveSkills` commands.
- [x] 1.2 Implement backend handlers in `packages/server/src/ws-router.ts` for listing, creating, and renaming skill directories using the `.disabled` suffix mechanism.
- [x] 1.3 Update the `PiSdkAppServerManager` in `packages/server/src/pi-sdk-app-server.ts` to dynamically resolve global and local skill paths and merge them into `DefaultResourceLoader` on session start.
- [x] 1.4 Update the `AntigravityAppServerManager` in `packages/server/src/antigravity-app-server.ts` and `antigravity-sdk-bridge.py` to support passing local and global skill paths.
- [x] 1.5 Refactor the settings UI in `apps/client/src/client/app/SettingsPage.tsx` to enable skills management for Pi, Antigravity, and Codex, with toggle controls and a unified "Save" workflow.
