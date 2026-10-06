# Nexus Product QA — UI + OpenCode + Feature Wiring

## UI direction

The shell and core workspace pages were moved toward a restrained developer-product UI: flat surfaces, hairline borders, compact controls, keyboard-first search/actions, and one accent color. Decorative gradients and heavy backdrop blur were removed from the product shell. Prompt Lab, Gateways, MCP Hub, Code Intelligence, Settings, and Automation are now marked as product surfaces.

Reference direction: Linear/Vercel-style workspace navigation and Raycast-style command/action patterns. These are interaction references, not copied assets.

## OpenCode

- `.opencode/opencode.json` added with environment-based model configuration.
- `.opencode/README.md` added.
- `scripts/install-opencode.mjs` added.
- Root script `npm run opencode:install` added.
- Backend status/model/install routes added under `/api/opencode`.
- Settings → AI Models & LLM Providers contains OpenCode status, install and model discovery controls.
- Mother Chat can send an explicitly selected `provider/model` to OpenCode.
- Code Intelligence can send an explicitly selected `provider/model` to OpenCode.
- Available-model API merges Nexus-configured models and OpenCode-discovered models when the CLI is installed.

## Model switching

### Mother Chat

- Model selector added to the Mother Chat header.
- Selection persists in browser local storage.
- Selected model is sent to `/agents/mother/chat`.
- Backend accepts `requestedModel` and uses OpenCode for provider/model IDs when available.
- Existing configured fallback chain remains intact when the selected runner is unavailable.

### Code Intelligence

- Model selector added to repository Q&A.
- Selection persists in browser local storage.
- Selected model is sent to `/code-intelligence/ask`.
- Backend uses OpenCode for explicit provider/model selections and retains existing Gemini/local fallbacks.

## Live feature wiring checks

| Feature | Backend route/events | Frontend route/listener | Status |
|---|---|---|---|
| Task board | `task:update`, `task:delete` | task store listeners | PASS (wiring) |
| Live activity | `activity:new` | activity store/listeners | PASS (wiring) |
| Approval UI | `approval:created`, `approval:resolved`, `gate:decided` | approval/automation listeners | PASS (wiring) |
| Run lifecycle | `process:run:created`, `process:run:updated`, `run:awaiting-approval` | run/automation listeners | PASS (wiring) |
| Agent communication | `thread:message`, `agent:message` | communication/chat listeners | PASS (wiring) |
| Gateway | CRUD + health/models/sessions | Gateway API + live CRUD refresh | PASS (wiring) |
| MCP | CRUD + refresh + tool call | MCP API + live refresh events | PASS (wiring) |
| Automation Hub | scheduler + run/approval events | live refresh listeners | PASS (wiring) |
| Network graph | thread/communication graph API | topology refresh path | PASS (wiring) |

## Security/config checks

- No real API keys/private keys/test credentials found by the repository secret scan.
- CI test credentials moved to GitHub repository secrets.
- Generated `backend/dist` and `frontend/dist` artifacts removed.
- OpenCode model/config values use environment substitution.

## Validation performed

- Modified TypeScript/TSX files: syntax-level TypeScript validation PASS.
- `package.json` and `.opencode/opencode.json`: JSON parse PASS.
- Secret-pattern scan: PASS.
- Stale `dist` directories: none present.
- Full backend `tsc`: NOT EXECUTED successfully because the checkout has no installed backend dependencies.
- Full frontend Vitest: NOT EXECUTED because `vitest` is not installed.
- npm dependency restore: attempted offline and online; registry/package download was unavailable/timed out in this execution environment.
- OpenCode CLI installation: attempted with `npm install -g opencode-ai@latest`; registry install timed out in this execution environment. The project contains the official reproducible installer and Settings install action.

## Important honesty boundary

This archive is **not marked as full runtime E2E verified** because the execution environment could not provide the project's dependency tree, PostgreSQL/Docker runtime, or OpenCode binary. The source-level API/event/UI wiring has been checked and the discovered gaps were fixed, but a real browser + database + provider run remains the final acceptance test on a machine with dependencies available.
