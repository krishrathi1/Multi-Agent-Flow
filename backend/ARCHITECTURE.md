# Nexus Backend Architecture

## Overview

Nexus is a multi-tenant AI agent orchestration and monitoring platform. The backend is built with Express 5 + TypeScript, Prisma ORM (PostgreSQL), Socket.IO for real-time updates, and a custom WebSocket RPC client for OpenClaw gateway integration.

**Port:** 4000
**Database:** PostgreSQL via Prisma
**Auth:** JWT (access + refresh tokens) + API keys + agent self-auth tokens

---

## Technology Stack

- **Express 5** — HTTP framework
- **Prisma 6.3** — ORM with PostgreSQL
- **Socket.IO 4.8** — Real-time WebSocket events
- **Zod 3.24** — Request validation
- **bcryptjs 3.0** — Password hashing
- **jsonwebtoken 9.0** — JWT token generation/verification
- **@modelcontextprotocol/sdk 1.26** — MCP server integration
- **ws 8.19** — WebSocket client for OpenClaw gateway RPC
- **TypeScript 5.7** — Type safety
- **Vitest 4.0** — Testing framework

---

## File Structure

```
src/
├── index.ts                    # Express app setup, route mounting, server start
├── types/
│   └── express.d.ts            # Express request type augmentation
├── lib/
│   ├── jwt.ts                  # JWT sign/verify (access 15m, refresh 7d)
│   ├── crypto.ts               # API key generation (nxk_ prefix) + SHA256 hashing
│   └── prisma.ts               # Prisma client singleton
├── middleware/
│   ├── auth.ts                 # requireAuth (JWT), requireRole (RBAC)
│   ├── api-key-auth.ts         # requireApiKey (X-API-Key header)
│   └── validate.ts             # Zod schema validation middleware
├── routes/
│   ├── auth.ts                 # Signup, login, refresh, logout, /me
│   ├── agents.ts               # Agent CRUD, chat, files, token generation
│   ├── activities.ts           # Activity listing + search
│   ├── tasks.ts                # Task CRUD
│   ├── threads.ts              # Inter-agent communication threads
│   ├── sessions.ts             # Session listing + timeline
│   ├── metrics.ts              # Token usage + performance metrics
│   ├── alerts.ts               # Alert rules + events
│   ├── commands.ts             # Human → agent commands
│   ├── organizations.ts        # Org settings, members, API keys
│   ├── gateways.ts             # Gateway CRUD + health/models/sessions
│   ├── mcp.ts                  # MCP server management per agent
│   ├── boards.ts               # Board + board group CRUD
│   ├── approvals.ts            # Approval requests + resolve
│   ├── agent-api.ts            # Agent self-auth endpoints (X-Agent-Token)
│   ├── remote.ts               # Remote agent heartbeat/activity/metrics
│   ├── config.ts               # Agent config (soul.md, enabled, interval)
│   ├── search.ts               # Activity full-text search
│   └── llm-providers.ts        # LLM provider management (BYOK/PLATFORM)
├── services/
│   ├── auth.service.ts         # User signup/login/token management
│   ├── agent.service.ts        # Agent operations + gateway sync
│   ├── activity.service.ts     # Activity creation + retrieval
│   ├── task.service.ts         # Task CRUD
│   ├── session.service.ts      # Session retrieval + timeline grouping
│   ├── thread.service.ts       # Message threads + communication graph
│   ├── command.service.ts      # Commands + activity search + agent config
│   ├── alert.service.ts        # Alert rule + event management
│   ├── metrics.service.ts      # Token + performance metrics aggregation
│   ├── org.service.ts          # Org + members + API key management
│   ├── gateway.service.ts      # Gateway lifecycle + RPC calls
│   ├── mcp.service.ts          # MCP server + tool management
│   ├── board.service.ts        # Board + board group operations
│   ├── approval.service.ts     # Approval lifecycle + auto-task completion
│   ├── remote.service.ts       # Remote agent data ingestion
│   └── llm-provider.service.ts # LLM provider management
├── websocket/
│   └── index.ts                # Socket.IO setup + event broadcasting
├── openclaw/
│   └── client.ts               # Gateway WebSocket RPC client + connection pool
└── test/
    ├── setup.ts                # Test helpers (DB connect/disconnect, cleanup)
    ├── api.test.ts             # 88 API integration tests
    └── middleware.test.ts      # 27 middleware unit tests
```

---

## Authentication & Security

### JWT Authentication
- **Access Token** — 15 minute expiry, `Authorization: Bearer <token>` header
- **Refresh Token** — 7 day expiry, SHA256-hashed in DB, rotated on every refresh
- **Secrets** — `JWT_SECRET` and `JWT_REFRESH_SECRET` from environment

### API Key Authentication
- **Format** — `nxk_{32 random hex bytes}`
- **Storage** — SHA256 hashed in DB, prefix stored for display
- **Header** — `X-API-Key`
- **Tracking** — `lastUsedAt`, optional `expiresAt`

### Agent Self-Authentication
- **Format** — `nxat_{32 random hex bytes}`
- **Storage** — SHA256 hashed in agent's `agentTokenHash` field
- **Header** — `X-Agent-Token`
- **Endpoints** — `/api/agent-api/*`

### Request Context (set by middleware)
```typescript
req.user            // { id, email, name }
req.organizationId  // Current org UUID
req.orgRole         // OWNER | ADMIN | MEMBER | VIEWER
req.agentId         // For agent self-auth requests
req.agentName       // Agent display name
req.agentBoardId    // Board the agent is assigned to
```

### Role-Based Access Control
- **OWNER** — Full access, can transfer ownership
- **ADMIN** — Manage members, settings, API keys
- **MEMBER** — Standard access to agents, tasks, boards
- **VIEWER** — Read-only access

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | Public | Create user + org, returns tokens |
| POST | `/login` | Public | Login, returns tokens |
| POST | `/refresh` | Public | Rotate refresh token |
| POST | `/logout` | JWT | Invalidate refresh token |
| GET | `/me` | JWT | Current user + org + role |

### Agents (`/api/agents`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List all agents (org-scoped) |
| GET | `/stats` | JWT | Agent stats (online/idle/offline/error counts) |
| GET | `/:id` | JWT | Agent details with activities and tasks |
| POST | `/` | JWT | Create agent (optionally via gateway RPC) |
| PATCH | `/:id` | JWT | Update agent fields |
| PATCH | `/:id/status` | JWT | Update agent status |
| POST | `/:id/heartbeat` | JWT | Record heartbeat |
| DELETE | `/:id` | JWT | Delete agent (+ gateway cleanup) |
| POST | `/:id/chat` | JWT | Chat with agent via gateway RPC |
| GET | `/:id/chat/history` | JWT | Get chat history |
| GET | `/:id/files` | JWT | List workspace files |
| GET | `/:id/files/:name` | JWT | Get file content |
| PUT | `/:id/files/:name` | JWT | Update file content |
| POST | `/:id/token` | JWT | Generate agent self-auth token |

### Tasks (`/api/tasks`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List tasks (priority + updated desc) |
| POST | `/` | JWT | Create task |
| PATCH | `/:id` | JWT | Update task |
| DELETE | `/:id` | JWT | Delete task |

### Boards (`/api/boards`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/groups` | JWT | List board groups |
| POST | `/groups` | JWT | Create board group |
| PATCH | `/groups/:id` | JWT | Update board group |
| DELETE | `/groups/:id` | JWT | Delete board group |
| GET | `/` | JWT | List boards with counts |
| GET | `/:id` | JWT | Board with tasks, agents, approvals |
| POST | `/` | JWT | Create board |
| PATCH | `/:id` | JWT | Update board |
| DELETE | `/:id` | JWT | Delete board |
| POST | `/:id/agents` | JWT | Add agent to board |
| DELETE | `/:id/agents/:agentId` | JWT | Remove agent from board |

### Approvals (`/api/approvals`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List approvals (filterable) |
| GET | `/stats` | JWT | Counts by status |
| GET | `/:id` | JWT | Approval details |
| POST | `/` | JWT | Create approval request |
| POST | `/:id/approve` | JWT | Approve (auto-completes COMPLETE_TASK) |
| POST | `/:id/reject` | JWT | Reject request |

### Gateways (`/api/gateways`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List gateways with agent count |
| GET | `/:id` | JWT | Gateway details |
| POST | `/` | JWT | Create + auto-connect |
| PATCH | `/:id` | JWT | Update + reconnect if changed |
| DELETE | `/:id` | JWT | Delete + disconnect |
| GET | `/:id/health` | JWT | Health check via RPC |
| GET | `/:id/models` | JWT | Available models from gateway |
| GET | `/:id/sessions` | JWT | Gateway sessions |

### LLM Providers (`/api/llm-providers`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List providers |
| POST | `/` | JWT | Upsert provider (BYOK/PLATFORM) |
| DELETE | `/:id` | JWT | Delete provider |
| POST | `/:id/test` | JWT | Test connection |
| GET | `/usage` | JWT | Credits + provider list |

### Activities (`/api/activities`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List with filters (agentId, type, since, limit, offset) |
| GET | `/search` | JWT | Full-text search |

### Sessions (`/api/sessions`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List sessions |
| GET | `/timeline` | JWT | Timeline data grouped by agent (4h window) |

### Threads (`/api/threads`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List communication threads |
| GET | `/graph` | JWT | Communication graph (nodes + edges) |
| GET | `/:id` | JWT | Thread with messages |

### Metrics (`/api/metrics`, `/api/tokens`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | Token usage or metric snapshots |
| GET | `/summary` | JWT | Aggregated summary by agent |

### Alerts (`/api/alerts`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/rules` | JWT | List alert rules |
| POST | `/rules` | JWT | Create alert rule |
| PATCH | `/rules/:id` | JWT | Update alert rule |
| GET | `/events` | JWT | List alert events |
| POST | `/events/:id/acknowledge` | JWT | Acknowledge alert |

### Commands (`/api/commands`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | JWT | Send command to agent |
| GET | `/` | JWT | List commands |

### Organizations (`/api/org`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | Org details |
| PATCH | `/` | JWT+Admin | Update org |
| GET | `/members` | JWT | List members |
| POST | `/members/invite` | JWT+Admin | Invite user |
| PATCH | `/members/:id` | JWT+Owner | Update role |
| DELETE | `/members/:id` | JWT+Admin | Remove member |
| GET | `/api-keys` | JWT+Admin | List API keys |
| POST | `/api-keys` | JWT+Admin | Create API key |
| DELETE | `/api-keys/:id` | JWT+Admin | Revoke API key |

### Agent Self-Auth API (`/api/agent-api` — X-Agent-Token)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/status` | Token | Agent reports status |
| POST | `/heartbeat` | Token | Agent heartbeat |
| POST | `/activity` | Token | Agent logs activity |
| POST | `/approvals` | Token | Agent requests approval |
| GET | `/approvals` | Token | Agent checks pending approvals |

### Remote Agent API (`/api/remote` — X-API-Key)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/heartbeat` | Key | Remote heartbeat (auto-creates agent) |
| POST | `/activity` | Key | Remote activity |
| POST | `/metrics` | Key | Remote metrics + token usage |

### MCP Servers (`/api/agents/:agentId/mcp-servers`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | List MCP servers for agent |
| POST | `/` | JWT | Add MCP server |
| PATCH | `/:id` | JWT | Update server |
| DELETE | `/:id` | JWT | Delete server |
| POST | `/:id/refresh-tools` | JWT | Refresh tools via MCP SDK |
| GET | `/:id/tools` | JWT | List tools |

### Health Check
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Simple health check |

---

## Service Layer

### auth.service.ts
- `signup(data)` — Create user + org in transaction, generate tokens, store hashed refresh
- `login(data)` — Verify password, get org membership, generate tokens
- `refresh(refreshToken)` — Verify token, rotate refresh, return new access token
- `logout(refreshToken)` — Delete hashed refresh token
- `getMe(userId)` — User + org + role

### agent.service.ts
- `getAllAgents(orgId)` — List agents with activity/task counts
- `getAgentById(id, orgId)` — Agent with recent activities and tasks
- `getAgentByName(orgId, name)` — Lookup by unique org+name
- `createAgent(orgId, data)` — Create in DB, optionally create in gateway via RPC
- `updateAgent(id, orgId, data)` — Update fields, sync workspace files + SOUL.md to gateway
- `updateAgentStatus(id, status, currentTask?)` — Update status + sync to gateway
- `recordHeartbeat(id)` — Update lastHeartbeat + set status ONLINE
- `deleteAgent(id, orgId)` — Delete from DB and gateway
- `getAgentStats(orgId)` — Count agents by status

### task.service.ts
- `getAllTasks(orgId)` — List sorted by priority + updated date
- `createTask(orgId, data)` — Create task
- `updateTask(id, orgId, data)` — Update fields
- `deleteTask(id, orgId)` — Delete with cascading dependencies

### board.service.ts
- `getAllBoardGroups(orgId)` / `createBoardGroup` / `updateBoardGroup` / `deleteBoardGroup`
- `getAllBoards(orgId)` — List with task/agent/approval counts
- `getBoardById(id, orgId)` — Board with tasks, agents, recent approvals
- `createBoard` / `updateBoard` / `deleteBoard`
- `addAgentToBoard(boardId, agentId, isLead?)` / `removeAgentFromBoard(agentId)`

### approval.service.ts
- `getApprovals(orgId, params?)` — List with status/boardId filter
- `createApproval(data)` — Create approval request
- `resolveApproval(id, orgId, status)` — Approve/reject; if `COMPLETE_TASK` → sets task to DONE
- `getApprovalStats(orgId)` — Count by status

### gateway.service.ts
- `getAllGateways` / `getGatewayById` / `createGateway` / `updateGateway` / `deleteGateway`
- `checkGatewayHealth(id, orgId)` — Health via RPC
- `getGatewayModels(id, orgId)` — Models from gateway
- `getGatewaySessions(id, orgId)` — Sessions from gateway
- `connectAllGateways()` — Reconnect all on startup

### llm-provider.service.ts
- `getProviders(orgId)` / `upsertProvider(orgId, data)` / `deleteProvider(id, orgId)`
- `getUsage(orgId)` — Credit balance + providers
- `ensureCredit(orgId)` — Upsert default credit record

### org.service.ts
- `getOrganization` / `updateOrganization`
- `getMembers` / `inviteMember` / `updateMemberRole` / `removeMember`
- `getApiKeys` / `createApiKey` / `revokeApiKey`

### Other Services
- **activity.service.ts** — Activity listing with filters + creation
- **session.service.ts** — Session listing + timeline grouped by agent (4h window)
- **thread.service.ts** — Message threads + communication graph (nodes + edges)
- **command.service.ts** — Command CRUD + activity search + agent config
- **alert.service.ts** — Alert rules + events + acknowledgment
- **metrics.service.ts** — Token usage + performance metrics with p95/success rate aggregation
- **mcp.service.ts** — MCP server + tool management via SDK
- **remote.service.ts** — Remote agent heartbeat/activity/metrics (auto-creates agents)

---

## WebSocket Events

All mutations emit Socket.IO events to `org:{organizationId}` room.

```
agent:created / agent:updated / agent:status / agent:heartbeat / agent:deleted / agent:config
task:update / task:delete
approval:created / approval:resolved
alert:rule:created / alert:rule:updated / alert:event:acknowledged
gateway:created / gateway:updated / gateway:deleted
boardGroup:created / boardGroup:updated / boardGroup:deleted
board:created / board:updated / board:deleted / board:agentAdded / board:agentRemoved
llm:updated / llm:deleted
activity:new
command:sent
```

---

## OpenClaw Gateway RPC Protocol

Nexus communicates with OpenClaw gateways via WebSocket using a custom RPC protocol.

### Frame Types
```typescript
RpcRequest:  { type: 'req', id: string, method: string, params?: unknown }
RpcResponse: { type: 'res', id: string, ok: boolean, payload?: unknown, error?: { code, message, details } }
RpcEvent:    { type: 'event', event: string, payload?: unknown, seq?: number }
```

### Connection Flow
1. Connect to gateway WebSocket URL
2. Gateway sends `connect.challenge` event
3. Nexus responds with `connect` RPC containing protocol version, client info, scopes, auth token
4. Auto-reconnection with exponential backoff (up to 50 attempts)

### RPC Methods Called by Nexus
```
health(probe: true)                                  — Health check
agents.create(name, workspace, emoji)               — Create agent in gateway
agents.delete(agentId)                              — Delete agent from gateway
agents.update(agentId, name?, workspace?, avatar?)   — Update agent
agents.files.list(agentId)                          — List workspace files
agents.files.get(agentId, name)                     — Read file
agents.files.set(agentId, name, content)            — Write file
agent(message, agentId, sessionKey, idempotencyKey) — Chat with agent
chat.history(sessionKey, limit)                     — Get chat history
models.list()                                       — List available models
sessions.list()                                     — List gateway sessions
```

### GatewayClient Class (`src/openclaw/client.ts`)
- `connect()` — Establish WebSocket, authenticate via RPC
- `rpc(method, params)` — Send RPC request, wait for response (30s timeout)
- `onEvent(handler)` — Register event listener
- `isConnected()` — Check if authenticated and connected
- `close()` — Close connection, cleanup timers

### Gateway Pool
- `getGatewayClient(gatewayId)` — Lookup client
- `connectGateway(gatewayId, url, token)` — Create + connect
- `disconnectGateway(gatewayId)` — Close + remove
- `requireGatewayClient(gatewayId)` — Get or throw if not connected

---

## Database Schema (Prisma)

### Core Models
- **Organization** — Multi-tenant org with name, slug, settings
- **User** — Account with email, bcrypt password, name
- **OrgMember** — User ↔ Org join table with role (OWNER/ADMIN/MEMBER/VIEWER)
- **RefreshToken** — Hashed refresh tokens with expiry

### Agents & Activity
- **Agent** — Individual agents with status, heartbeat, workspace, soul.md, gateway connection
- **Activity** — Agent activity log (HEARTBEAT, TASK_START, TASK_COMPLETE, ERROR, MESSAGE, DELEGATION, ALERT, SYSTEM)
- **Session** — Agent work sessions with duration, status, token usage, cost
- **Message** — Inter-agent communication threads

### Tasks & Workflow
- **Task** — Tasks with status (BACKLOG → ASSIGNED → IN_PROGRESS → REVIEW → DONE), priority (LOW/MEDIUM/HIGH/CRITICAL)
- **TaskDependency** — Blocking/dependent relationships
- **Approval** — Human-in-the-loop requests with status and confidence score
- **Command** — Commands sent to agents

### Monitoring & Metrics
- **TokenUsage** — Per-call token tracking (input, output, total, model, cost)
- **MetricSnapshot** — Performance metrics (response time, success/error, tool name)
- **AlertRule** — Alerting conditions with threshold and window
- **AlertEvent** — Alert trigger events with severity and acknowledgment

### MCP & Gateway Integration
- **McpServer** — MCP servers with transport type (SSE/STREAMABLE_HTTP)
- **McpTool** — Tools available from MCP servers
- **Gateway** — OpenClaw gateway connections with URL, token, status
- **LlmProvider** — LLM provider config with mode (BYOK/PLATFORM)

### Boards & Collaboration
- **Board** — Kanban boards with type (goal), objective, success metrics, target date
- **BoardGroup** — Board grouping/categories
- **BoardMemory** — Persistent context/memory for boards
- **UsageCredit** — Billing credit tracking per org

---

## Key Flows

### Agent Lifecycle
1. **Create** — POST /api/agents → DB record + optional gateway RPC
2. **Heartbeat** — POST heartbeat → update lastHeartbeat, set ONLINE, emit WebSocket
3. **Chat** — POST chat → gateway RPC `agent` method → stream response
4. **Update** — PATCH agent → sync workspace files + SOUL.md to gateway
5. **Delete** — DELETE → remove from gateway + DB

### Task Workflow
1. Create → BACKLOG
2. Assign to agent → ASSIGNED
3. Agent starts → IN_PROGRESS
4. Complete → REVIEW (if board requires approval)
5. Approval approved → DONE (via resolveApproval with COMPLETE_TASK)

### Approval Flow
1. Agent requests approval via POST /api/agent-api/approvals
2. Creates Approval record with PENDING status
3. Human reviews via dashboard
4. Approve/Reject via POST /api/approvals/:id/approve or /reject
5. If actionType=COMPLETE_TASK, associated task moves to DONE
6. WebSocket event emitted to org room

---

## Environment Variables

```
DATABASE_URL         # PostgreSQL connection string
PORT                 # Express server port (default: 4000)
JWT_SECRET           # JWT access token secret
JWT_REFRESH_SECRET   # JWT refresh token secret
```

---

## Testing

- **Framework:** Vitest 4.0 with `pool: 'forks'` and `singleFork: true`
- **Backend Tests:** 115 tests (88 API integration + 27 middleware)
- **Integration tests** hit real PostgreSQL with proper cleanup via `cleanupTestData()`
- **Test files:** `src/test/api.test.ts`, `src/test/middleware.test.ts`
- **Run:** `npm test` or `npm run test:watch`
