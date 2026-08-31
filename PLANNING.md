# Nexus — Phase 4: Real OpenClaw Agent Integration + Mission Control Feature Parity

## Context

Nexus currently has a strong monitoring/observability UI (dashboard, timeline, topology, metrics, alerts, MCP, landing page, docs) but agents are **database-only records** with a **fake simulator**. The OpenClaw Mission Control project (`/home/ubuntu/openclaw-mission-control/`) shows the right approach: real agent provisioning via Gateway RPC, boards for goal-oriented work, approval workflows, agent self-auth, chat, workspace files, skills marketplace, and more.

**Goal:** Combine Nexus's existing monitoring strengths with Mission Control's agent management capabilities. The result: users create real OpenClaw agents, chat with them, manage their workspaces, organize work via boards, and monitor everything in real-time.

---

## Feature Comparison: What To Add

### Already in Nexus (keep as-is)
- Real-time dashboard with agent cards, heartbeat charts, system health
- Agent profile with activity history, soul viewer
- Inter-agent communications + topology graph
- Gantt-style session timeline
- Network topology visualization
- Agent controls (enable/disable)
- Token usage + cost analytics
- Alert system (rules, events, severity, acknowledgment)
- Search & audit log
- MCP server management per agent
- Socket.IO real-time broadcasting
- Org management (roles: Owner/Admin/Member/Viewer)
- Landing page + documentation site
- JWT auth + API key auth for remote agents

### From Mission Control (add to Nexus)
| Feature | Priority | Phase |
|---------|----------|-------|
| Gateway WebSocket RPC client | Critical | 4A |
| Gateway CRUD (multi-gateway support) | Critical | 4A |
| Real agent provisioning via Gateway | Critical | 4A |
| Remove fake simulator | Critical | 4A |
| Chat with agents (send message + history) | Critical | 4B |
| Workspace file editor (SOUL.md, TOOLS.md, etc.) | Critical | 4B |
| Models listing from Gateway | High | 4B |
| Boards (goal-oriented work containers) | High | 4C |
| Board groups (cross-board coordination) | High | 4C |
| Board-level approval policies | High | 4C |
| Approval workflows (request/approve/reject) | High | 4D |
| Agent tokens (agent self-authentication) | High | 4D |
| Agent-scoped API routes | High | 4D |
| Board memory (persistent context) | Medium | 4E |
| Task dependencies (blocking/depends-on) | Medium | 4E |
| Inbound webhooks per board | Medium | 4E |
| Skills marketplace | Medium | 4F |
| Custom fields on tasks | Low | 4F |
| SSE streaming for activity feed | Low | 4F |
| BYOK + Platform-managed LLM keys | High | 4B |
| Usage credits + billing tracking | Medium | 4D |

---

## LLM Model & API Key Strategy

### How It Works
The OpenClaw Gateway manages all LLM interactions. When a user chats with an agent:

```
User → Nexus Frontend → Nexus Backend → Gateway RPC (agent send) → OpenClaw Gateway → LLM Provider
```

### Hybrid Model: BYOK + Platform-Managed (Both Available)

Customers choose how they want to pay for LLM usage:

**Option A: Bring Your Own Key (BYOK)**
- Customer provides their own API keys (OpenAI, Anthropic, Google, etc.) in Nexus Settings
- Keys are stored encrypted in DB and pushed to the Gateway config per-agent
- Customer pays their LLM provider directly — zero markup from Nexus
- Best for: teams with existing provider accounts, high-volume users, enterprise

**Option B: Platform-Managed (Pay-as-you-go)**
- Customer uses Nexus-provided API keys — no setup needed
- We track token usage per org via the existing `TokenUsage` model
- Bill based on consumption (markup on provider costs)
- Best for: new users, small teams, users who want simplicity

**How the customer chooses:**
- In Settings → "LLM Providers" section
- Toggle per provider: "Use my own key" vs "Use Nexus credits"
- If BYOK: input field for API key (stored encrypted)
- If Platform: shows current usage + balance/billing info

### New Prisma Models

```prisma
model LlmProvider {
  id              String   @id @default(uuid())
  organizationId  String
  provider        String              // "openai", "anthropic", "google", etc.
  mode            LlmProviderMode     // BYOK or PLATFORM
  apiKey          String?             // encrypted, only for BYOK
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(...)
  @@unique([organizationId, provider])
}

enum LlmProviderMode {
  BYOK
  PLATFORM
}

model UsageCredit {
  id              String   @id @default(uuid())
  organizationId  String
  balanceCents    Int      @default(0)    // prepaid credits in cents
  totalSpentCents Int      @default(0)    // lifetime spend
  lastTopUpAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(...)
  @@unique([organizationId])
}
```

### Gateway Key Routing
When Nexus sends a chat request to the Gateway:
1. Look up the org's `LlmProvider` for the agent's model provider
2. If `mode = BYOK`: pass the org's API key in the Gateway RPC call (or configure per-agent in Gateway)
3. If `mode = PLATFORM`: use the platform's default keys (pre-configured in Gateway)
4. After response: record token usage in `TokenUsage` table + deduct from `UsageCredit` if platform-managed

### Frontend: Settings → LLM Providers
- Card per provider (OpenAI, Anthropic, Google, etc.) showing provider logo
- Toggle: "Use my own key" / "Use Nexus credits"
- API key input (masked, with test connection button)
- Usage stats: tokens used this month, estimated cost
- For platform mode: credit balance, top-up button (future: Stripe integration)

---

## Architecture

```
┌──────────────────┐       WebSocket RPC         ┌───────────────────────┐
│  Nexus Backend   │ ─────────────────────────── │  OpenClaw Gateway(s)  │
│  (Express+Prisma)│  agents.create/update/delete │  ws://host:18789      │
│                  │  agents.files.get/set         │                       │
│                  │  agent (send message)         │  Real AI agents with  │
│                  │  chat.history                 │  LLM, tools, sessions │
│                  │  sessions.list                │                       │
│                  │  models.list, health          │                       │
└────────┬─────────┘                              └───────────────────────┘
         │ REST + Socket.IO                              ▲
         │                                               │ X-Agent-Token
┌────────┴─────────┐                              ┌──────┴──────────┐
│  Nexus Frontend  │                              │  Agents calling  │
│  (React+Vite)    │                              │  back to Nexus   │
│  Chat, Boards,   │                              │  (tasks, approvals│
│  Workspace, etc. │                              │   memory, status) │
└──────────────────┘                              └─────────────────┘
```

**Multi-gateway support:** Each org can register multiple Gateway connections (like MC). Each gateway has URL + token + workspace_root. Agents are linked to a specific gateway.

**Multi-tenancy:** Agent IDs prefixed with org slug: `{orgSlug}--{agentName}` to isolate within single-instance gateways.

---

## Phase 4A: Gateway Client + Real Agent Provisioning

### New: `backend/src/openclaw/client.ts` — Gateway WebSocket RPC Client

Implements the OpenClaw Gateway protocol (same as MC's `gateway_rpc.py` but in TypeScript):

```
Protocol flow:
1. Connect to ws://{url}
2. Receive { type: "event", event: "connect.challenge", payload: { nonce, ts } }
3. Send { type: "req", id, method: "connect", params: { auth: { token }, client: {...}, scopes: ["operator.admin"] } }
4. Receive { type: "res", id, ok: true, payload: HelloOk }
5. RPC: Send { type: "req", id, method, params } → Receive { type: "res", id, ok, payload }
6. Events: Receive { type: "event", event, payload } for real-time updates
```

**Exports:**
- `createGatewayClient(url, token)` — returns client instance with auto-reconnect
- `client.rpc(method, params)` — Promise-based RPC call
- `client.onEvent(handler)` — listen to Gateway events
- `client.isConnected()` — connection status
- `client.close()` — disconnect

**Gateway pool:** Map of `gatewayId → client` for multi-gateway support.

### New: Prisma model `Gateway`

```prisma
model Gateway {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  url            String              // ws://localhost:18789
  token          String              // encrypted at rest
  workspaceRoot  String   @default("")
  status         GatewayStatus @default(UNKNOWN)  // ONLINE, OFFLINE, UNKNOWN
  lastCheckedAt  DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  agents         Agent[]

  @@unique([organizationId, name])
}

enum GatewayStatus {
  ONLINE
  OFFLINE
  UNKNOWN
}
```

Add to `Agent` model:
```prisma
gatewayId       String?
gatewayAgentId  String?   @unique
gateway         Gateway?  @relation(fields: [gatewayId], references: [id])
```

### New: `backend/src/routes/gateways.ts` — Gateway CRUD

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/gateways` | List org gateways |
| POST | `/api/gateways` | Create gateway (validates connection) |
| GET | `/api/gateways/:id` | Get gateway details |
| PATCH | `/api/gateways/:id` | Update gateway |
| DELETE | `/api/gateways/:id` | Delete gateway |
| GET | `/api/gateways/:id/health` | Gateway health check via RPC |
| GET | `/api/gateways/:id/models` | List available LLM models |
| GET | `/api/gateways/:id/sessions` | List Gateway sessions |

### Modify: `backend/src/services/agent.service.ts`

Agent CRUD now calls Gateway RPC:

| Operation | DB | Gateway RPC |
|-----------|-----|-------------|
| Create | `prisma.agent.create(...)` | `agents.create({ name, workspace })` + `agents.files.set(SOUL.md)` |
| Update | `prisma.agent.update(...)` | `agents.update({ agentId })` + `agents.files.set(...)` if soul changed |
| Delete | `prisma.agent.delete(...)` | `agents.delete({ agentId })` |

Graceful degradation: if Gateway unreachable, create DB record and mark `gatewayAgentId = null` (sync later).

### Modify: `backend/src/index.ts`
- Remove `startSimulator(io)` call and import
- Add Gateway client pool initialization
- Mount `/api/gateways` routes

### Delete: `backend/src/simulator/index.ts`

### New: `frontend/src/pages/Gateways.tsx` — Gateway management page
- Table listing gateways with status indicators (online/offline)
- Create gateway form (name, URL, token)
- Edit/delete gateways
- Health check button
- Connected agents count

### Modify: `frontend/src/App.tsx` — add `/gateways` route
### Modify: `frontend/src/components/layout/Sidebar.tsx` — add "Gateways" nav item (icon: `Server`)
### Modify: `frontend/src/pages/AgentCreate.tsx` — add gateway selector dropdown

**Dependency:** `npm install ws && npm install -D @types/ws` (backend)

---

## Phase 4B: Chat Interface + Workspace Files

### New routes on `backend/src/routes/agents.ts`:

| Method | Path | Purpose | Gateway RPC |
|--------|------|---------|-------------|
| POST | `/:id/chat` | Send message to agent | `agent` (send) |
| GET | `/:id/chat/history` | Get chat history | `chat.history` |
| GET | `/:id/files` | List workspace files | `agents.files.list` |
| GET | `/:id/files/:name` | Get file content | `agents.files.get` |
| PUT | `/:id/files/:name` | Update file content | `agents.files.set` |

**Chat endpoint details:**
- Session key: `nexus-{orgSlug}-{agentName}` (consistent across requests)
- Idempotency key: `uuid()` per request
- Creates Activity record after each interaction
- Returns `{ status, result, summary }`

### New: `frontend/src/pages/Chat.tsx` — Full-page chat interface

**Layout (3-column):**
- **Left (w-72):** Agent list with status indicators, search filter, click to select
- **Center:** Chat message area (scrollable) + input bar at bottom
- **Right (w-80, collapsible):** Selected agent info card (name, status, model, gateway, last activity)

**Components:**
| Component | File | Purpose |
|-----------|------|---------|
| `ChatMessage` | `components/chat/ChatMessage.tsx` | Message bubble (user vs agent styling, timestamp, markdown rendering) |
| `ChatInput` | `components/chat/ChatInput.tsx` | Text input + send button, Enter to send, Shift+Enter for newline |
| `AgentChatList` | `components/chat/AgentChatList.tsx` | Sidebar listing agents with status dots, search |

### Modify: `frontend/src/pages/AgentCreate.tsx` — Workspace Files Editor

Add a tabbed editor section (edit mode only):
- Tabs: SOUL.md, TOOLS.md, IDENTITY.md, AGENTS.md, USER.md, HEARTBEAT.md, MEMORY.md
- Monospace textarea per tab
- Auto-save on blur or Save button
- Fetches from `api.agents.files.list/get`, saves via `api.agents.files.update`
- Model selector dropdown (populated from gateway's `models.list`)
- Gateway sync status indicator

### New: LLM Provider Management (Settings Page)

Add to `backend/prisma/schema.prisma`: `LlmProvider` and `UsageCredit` models (see API Key Strategy section above).

New route: `backend/src/routes/llm-providers.ts`
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/llm-providers` | List org's provider configs |
| POST | `/api/llm-providers` | Add/update provider (BYOK key or set to PLATFORM) |
| DELETE | `/api/llm-providers/:id` | Remove provider config |
| POST | `/api/llm-providers/:id/test` | Test API key connectivity |
| GET | `/api/llm-providers/usage` | Get usage stats + credit balance |

Frontend: Add "LLM Providers" tab to `frontend/src/pages/Settings.tsx`
- Provider cards (OpenAI, Anthropic, Google, etc.)
- BYOK vs Platform toggle per provider
- API key input with test button
- Usage stats display

### Modify: `frontend/src/lib/api.ts` — add chat, files, gateway, llm-provider API methods
### Modify: `frontend/src/types/index.ts` — add `ChatMessage`, `ChatHistory`, `WorkspaceFile`, `GatewayHealth`, `ModelInfo`, `LlmProvider`, `UsageCredit` types

---

## Phase 4C: Boards + Board Groups

Boards are goal-oriented work containers (from Mission Control). Each board has tasks, agents, approval policies, and memory.

### New Prisma models:

```prisma
model Board {
  id                String       @id @default(uuid())
  organizationId    String
  name              String
  slug              String
  description       String       @default("")
  gatewayId         String?
  boardGroupId      String?
  boardType         String       @default("goal")     // "goal" or "regular"
  objective         String?
  successMetrics    Json?
  targetDate        DateTime?
  maxAgents         Int          @default(3)
  requireApprovalForDone  Boolean @default(true)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  organization      Organization @relation(...)
  gateway           Gateway?     @relation(...)
  boardGroup        BoardGroup?  @relation(...)
  tasks             Task[]       @relation("BoardTasks")
  agents            Agent[]      @relation("BoardAgents")
  approvals         Approval[]
  memory            BoardMemory[]

  @@unique([organizationId, slug])
}

model BoardGroup {
  id              String   @id @default(uuid())
  organizationId  String
  name            String
  slug            String
  description     String   @default("")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(...)
  boards          Board[]

  @@unique([organizationId, slug])
}
```

### Modify: existing `Task` model
Add optional `boardId` field (tasks can belong to a board or be standalone like now).

### Modify: existing `Agent` model
Add optional `boardId` field + `isBoardLead` boolean (board lead can approve/delegate).

### New: `backend/src/routes/boards.ts`
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/boards` | List boards (with task/agent counts) |
| POST | `/api/boards` | Create board |
| GET | `/api/boards/:id` | Get board with tasks + agents |
| PATCH | `/api/boards/:id` | Update board |
| DELETE | `/api/boards/:id` | Delete board (cascade) |
| GET | `/api/boards/:id/snapshot` | Board snapshot (aggregated view) |

### New: `backend/src/routes/board-groups.ts`
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/board-groups` | List board groups |
| POST | `/api/board-groups` | Create group |
| PATCH | `/api/board-groups/:id` | Update group |
| DELETE | `/api/board-groups/:id` | Delete group |

### New: `frontend/src/pages/Boards.tsx` — Board list + create
### New: `frontend/src/pages/BoardDetail.tsx` — Kanban view of board tasks + assigned agents + approval panel
### New: `frontend/src/pages/BoardGroups.tsx` — Group management

### Modify: `frontend/src/App.tsx` — add `/boards`, `/boards/:id`, `/board-groups` routes
### Modify: `frontend/src/components/layout/Sidebar.tsx` — add "Boards" and "Board Groups" nav items

---

## Phase 4D: Approval Workflows + Agent Tokens

### New Prisma model:

```prisma
model Approval {
  id          String          @id @default(uuid())
  boardId     String
  taskId      String?
  agentId     String?           // agent requesting approval
  actionType  String            // "task_done", "status_change", etc.
  payload     Json?
  confidence  Float?            // agent's confidence (0-1)
  status      ApprovalStatus    @default(PENDING)
  resolvedAt  DateTime?
  createdAt   DateTime          @default(now())

  board       Board  @relation(...)
  task        Task?  @relation(...)
  agent       Agent? @relation(...)
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### Add to `Agent` model:
```prisma
agentTokenHash  String?   @unique    // hashed token for agent self-auth
```

### New: `backend/src/middleware/agent-auth.ts`
- Reads `X-Agent-Token` header
- Hashes and looks up in `Agent.agentTokenHash`
- Sets `req.agentId` and `req.organizationId`
- Updates `agent.lastHeartbeat` and status to ONLINE

### New: `backend/src/routes/agent-api.ts` — Agent-scoped routes (authenticated by agent token)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agent/board` | Get agent's board context |
| GET | `/api/agent/tasks` | List tasks on agent's board |
| POST | `/api/agent/tasks` | Create task |
| PATCH | `/api/agent/tasks/:id` | Update task status |
| POST | `/api/agent/tasks/:id/comments` | Add comment |
| POST | `/api/agent/approvals` | Request approval |
| GET | `/api/agent/approvals` | List agent's approvals |
| POST | `/api/agent/memory` | Store memory entry |
| GET | `/api/agent/memory` | Read memory |
| POST | `/api/agent/heartbeat` | Record heartbeat |

### New: `backend/src/routes/approvals.ts` — Human-facing approval routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/boards/:boardId/approvals` | List approvals for board |
| PATCH | `/api/boards/:boardId/approvals/:id` | Approve or reject |

### New: `frontend/src/pages/Approvals.tsx` — Global approvals view
- List all pending approvals across boards
- Approve/reject buttons with confirmation
- Confidence score display
- Filter by board, agent, status

### Modify: `frontend/src/pages/BoardDetail.tsx` — add approval panel sidebar
### Modify: Agent create flow — generate agent token on creation, show once

---

## Phase 4E: Board Memory + Task Dependencies

### New Prisma model:

```prisma
model BoardMemory {
  id        String   @id @default(uuid())
  boardId   String
  content   String
  tags      Json?       // string array
  isChat    Boolean  @default(false)
  source    String?
  createdAt DateTime @default(now())

  board     Board @relation(...)
}

model TaskDependency {
  id              String @id @default(uuid())
  dependentTaskId String    // the task that is blocked
  blockingTaskId  String    // the task that must complete first

  dependentTask   Task @relation("DependentOn", ...)
  blockingTask    Task @relation("Blocking", ...)

  @@unique([dependentTaskId, blockingTaskId])
}
```

### New routes for board memory and task dependencies
### Modify: `frontend/src/pages/BoardDetail.tsx` — add memory panel + dependency arrows on kanban

---

## Phase 4F: Skills, Webhooks, Custom Fields

### Skills Marketplace
- New Prisma models: `MarketplaceSkill`, `InstalledSkill`
- Routes: list marketplace skills, install to gateway, list installed
- Frontend: Skills page with browse + install UI

### Inbound Webhooks
- New Prisma model: `BoardWebhook`, `WebhookPayload`
- Routes: CRUD webhooks per board, inbound ingestion endpoint (public)
- Frontend: Webhook management per board

### Custom Fields
- New Prisma models: `CustomFieldDefinition`, `CustomFieldValue`
- Routes: CRUD field definitions, set values on tasks
- Frontend: Custom fields editor in board settings, display on task cards

### SSE Streaming
- Add SSE endpoints for real-time task/approval/activity updates (complement Socket.IO)

---

## New Dependencies

**Backend:**
```
npm install ws
npm install -D @types/ws
```

**Frontend:** No new dependencies needed.

---

## Complete File Summary

### Phase 4A — New Files (5)
| File | Purpose |
|------|---------|
| `backend/src/openclaw/client.ts` | Gateway WebSocket RPC client |
| `backend/src/services/gateway.service.ts` | Gateway CRUD service |
| `backend/src/routes/gateways.ts` | Gateway REST endpoints |
| `frontend/src/pages/Gateways.tsx` | Gateway management page |
| `frontend/src/components/gateways/GatewayForm.tsx` | Gateway create/edit form |

### Phase 4B — New Files (4)
| File | Purpose |
|------|---------|
| `frontend/src/pages/Chat.tsx` | Agent chat page |
| `frontend/src/components/chat/ChatMessage.tsx` | Chat bubble component |
| `frontend/src/components/chat/ChatInput.tsx` | Chat input component |
| `frontend/src/components/chat/AgentChatList.tsx` | Agent list sidebar |

### Phase 4C — New Files (5)
| File | Purpose |
|------|---------|
| `backend/src/services/board.service.ts` | Board + board group CRUD |
| `backend/src/routes/boards.ts` | Board REST endpoints |
| `backend/src/routes/board-groups.ts` | Board group endpoints |
| `frontend/src/pages/Boards.tsx` | Board list + create |
| `frontend/src/pages/BoardDetail.tsx` | Kanban board view |

### Phase 4D — New Files (4)
| File | Purpose |
|------|---------|
| `backend/src/middleware/agent-auth.ts` | Agent token auth middleware |
| `backend/src/routes/agent-api.ts` | Agent-scoped API routes |
| `backend/src/routes/approvals.ts` | Approval management routes |
| `frontend/src/pages/Approvals.tsx` | Approvals dashboard |

### Modified Files (across all phases)
| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add Gateway, Board, BoardGroup, Approval, BoardMemory, TaskDependency models + Agent fields |
| `backend/src/services/agent.service.ts` | Gateway RPC on create/update/delete |
| `backend/src/routes/agents.ts` | Chat + workspace file endpoints |
| `backend/src/index.ts` | Remove simulator, init gateway pool, mount new routes |
| `backend/package.json` | Add `ws` dependency |
| `frontend/src/lib/api.ts` | All new API methods |
| `frontend/src/types/index.ts` | All new types |
| `frontend/src/App.tsx` | New routes: /chat, /gateways, /boards, /boards/:id, /board-groups, /approvals |
| `frontend/src/components/layout/Sidebar.tsx` | New nav items: Chat, Gateways, Boards, Approvals |
| `frontend/src/pages/AgentCreate.tsx` | Gateway selector, model selector, workspace file editor, agent token display |
| `frontend/src/pages/Dashboard.tsx` | Gateway health card |
| `frontend/src/pages/KanbanBoard.tsx` | Board filter/selector integration |

### Deleted Files
| File | Reason |
|------|--------|
| `backend/src/simulator/index.ts` | Replaced by real Gateway integration |

---

## Build Order

### Step 1: Phase 4A — Gateway + Real Agents (do first)
Everything else depends on the Gateway client being functional.

### Step 2: Phase 4B — Chat + Files (parallelizable)
Frontend chat UI and workspace editor. Can split into 2 sub-agents.

### Step 3: Phase 4C — Boards (parallelizable with Step 2)
Backend board models/routes + frontend board pages.

### Step 4: Phase 4D — Approvals + Agent Tokens
Depends on boards existing (approvals are board-scoped).

### Step 5: Phase 4E — Memory + Dependencies
Enhancement to boards.

### Step 6: Phase 4F — Skills, Webhooks, Custom Fields
Lower priority features, can be done last.

---

## Verification

1. **Gateway CRUD:** Create gateway → connection succeeds → status shows ONLINE
2. **Create agent:** Select gateway → fill form → real OpenClaw agent created → `agents.list` confirms
3. **Chat with agent:** Send message → get real LLM response → history persists
4. **Workspace files:** Edit SOUL.md in UI → verify change via `agents.files.get`
5. **Delete agent:** Removed from both DB and Gateway
6. **Boards:** Create board → assign agents → manage tasks in kanban view
7. **Approvals:** Agent requests approval → shows in approval queue → human approves → task status updates
8. **Agent token:** Agent authenticates with X-Agent-Token → can create tasks, report status
9. **Board memory:** Agent stores context → persists across sessions
10. **Existing features work:** Dashboard, timeline, topology, metrics, alerts, search all still functional
11. **Build passes:** `npx tsc --noEmit` (backend) + `npx vite build` (frontend) succeed
12. **No simulator:** Zero fake data — everything is real
