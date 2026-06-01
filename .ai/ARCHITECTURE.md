# Architecture Reference

## Overview
Kanna is a beautiful web UI wrapper for Claude Code. It has a React client frontend (communicating over WebSockets) and a Node/Bun supervisor/backend CLI.

## Code Separation
- **src/client**: React web client UI, state stores (zustand), terminal components (xterm), and visual panels.
- **src/server**: Supervisor backend CLI, local API server, project discovery, settings management, WebSocket routing, and process spawning.
- **src/shared**: Constants, ports, types, and utility files shared across both the client and server.
- **src/export-viewer**: A specialized app configuration to bundle chat transcripts and view exported conversation states offline.
