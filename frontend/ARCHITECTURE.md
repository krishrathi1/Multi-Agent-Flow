# Nexus Frontend Architecture

## Overview

Nexus is a comprehensive AI agent monitoring and management platform. The frontend is a React 19 SPA with TypeScript, providing real-time monitoring, task management, inter-agent communications, performance analytics, and human-in-the-loop controls.

**Dev Port:** 5174
**API Proxy:** localhost:4000
**Build:** Vite 6.1

---

## Technology Stack

- **React 19** — UI framework
- **React Router 7.1** — Client-side routing
- **TypeScript 5.7** — Type safety
- **Tailwind CSS 4.0** — Utility-first styling (via Vite plugin)
- **Zustand 5.0** — State management
- **Socket.IO Client 4.8** — Real-time WebSocket events
- **Recharts 2.15** — Charts and data visualization
- **@hello-pangea/dnd 17.0** — Drag-and-drop (Kanban boards)
- **Lucide React** — Icon library
- **date-fns 4.1** — Date formatting
- **Vite 6.1** — Build tool and dev server
- **Vitest 4.0** — Testing framework

---

## Directory Structure

```
src/
├── main.tsx                     # App entry point
├── App.tsx                      # Router configuration (all routes)
├── index.css                    # Global styles + Tailwind imports
├── components/
│   ├── layout/
│   │   ├── Layout.tsx           # Main wrapper (Sidebar + Outlet + Socket.IO)
│   │   ├── Sidebar.tsx          # Fixed left navigation (264px)
│   │   └── Header.tsx           # Page title + live agent stats
│   ├── dashboard/
│   │   ├── StatsBar.tsx         # Summary statistics bar
│   │   ├── AgentCard.tsx        # Agent status card
│   │   └── SystemHealth.tsx     # System health indicator
│   ├── kanban/
│   │   ├── Column.tsx           # Droppable task column
│   │   ├── TaskCard.tsx         # Draggable task card
│   │   └── AddTaskModal.tsx     # New task modal
│   ├── activity/
│   │   ├── ActivityItem.tsx     # Activity log entry
│   │   └── ActivityFilters.tsx  # Filter by agent/type
│   ├── agent/
│   │   ├── AgentActivity.tsx    # Agent-specific activity history
│   │   ├── HeartbeatChart.tsx   # Heartbeat timing chart
│   │   └── SoulViewer.tsx       # SOUL.md viewer/editor
│   └── auth/
│       └── ProtectedRoute.tsx   # Auth gate HOC
├── pages/
│   ├── Dashboard.tsx            # Main overview with agent cards
│   ├── Login.tsx                # Email/password login
│   ├── Signup.tsx               # New account registration
│   ├── ActivityFeed.tsx         # Real-time activity stream
│   ├── Chat.tsx                 # Agent chat (via gateway)
│   ├── Communications.tsx       # Inter-agent message threads
│   ├── Timeline.tsx             # Session Gantt chart (4h window)
│   ├── KanbanBoard.tsx          # Global task board (5 columns)
│   ├── Boards.tsx               # Board list with groups
│   ├── BoardDetail.tsx          # Board Kanban + assigned agents
│   ├── Approvals.tsx            # Approval queue dashboard
│   ├── Topology.tsx             # Communication graph visualization
│   ├── AgentControls.tsx        # Human command center
│   ├── Metrics.tsx              # Performance analytics
│   ├── Alerts.tsx               # Alert rules + events
│   ├── SearchAudit.tsx          # Full-text activity search
│   ├── Gateways.tsx             # Gateway management
│   ├── AgentCreate.tsx          # Create/edit agent
│   ├── AgentProfile.tsx         # Agent detail (heartbeat, files, soul.md)
│   ├── Settings.tsx             # Account + org settings
│   ├── landing/                 # Public landing page
│   │   ├── LandingPage.tsx
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Architecture.tsx
│   │   ├── UseCases.tsx
│   │   └── CTA.tsx
│   └── docs/                    # Documentation portal
│       ├── DocsLayout.tsx
│       ├── DocsSidebar.tsx
│       ├── DocsGettingStarted.tsx
│       ├── DocsMcpIntegration.tsx
│       ├── DocsRemoteAgents.tsx
│       ├── DocsAgentManagement.tsx
│       ├── DocsAlerts.tsx
│       ├── DocsApiReference.tsx
│       ├── DocsOrganizations.tsx
│       └── DocsWebSocketEvents.tsx
├── stores/
│   ├── auth-store.ts            # Authentication state + tokens
│   ├── agent-store.ts           # Agent list + stats + selection
│   ├── activity-store.ts        # Activity log stream
│   └── task-store.ts            # Task CRUD + status moves
├── lib/
│   ├── api.ts                   # Centralized API client (all endpoints)
│   ├── utils.ts                 # Utilities (cn, timeAgo, color maps)
│   └── socket.ts                # Socket.IO client singleton
├── types/
│   └── index.ts                 # All TypeScript type definitions
└── test/
    ├── setup.ts                 # jest-dom matchers setup
    └── app.test.tsx             # 60 frontend tests
```

---

## Routing

All routes defined in `App.tsx`:

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | RootRedirect | No | → dashboard if auth'd, else landing |
| `/login` | Login | No | Sign in form |
| `/signup` | Signup | No | Registration form |
| `/dashboard` | Dashboard | Yes | Agent overview + live feed |
| `/activity` | ActivityFeed | Yes | Searchable activity stream |
| `/chat` | Chat | Yes | Agent chat (requires gateway) |
| `/comms` | Communications | Yes | Inter-agent threads + topology |
| `/timeline` | Timeline | Yes | Session Gantt chart |
| `/tasks` | KanbanBoard | Yes | Global 5-column task board |
| `/boards` | Boards | Yes | Board list with groups |
| `/boards/:id` | BoardDetail | Yes | Board Kanban + agents |
| `/approvals` | Approvals | Yes | Approval queue |
| `/topology` | Topology | Yes | Force-directed comm graph |
| `/controls` | AgentControls | Yes | Human command center |
| `/metrics` | Metrics | Yes | Token/cost/performance analytics |
| `/alerts` | Alerts | Yes | Alert rules + events |
| `/search` | SearchAudit | Yes | Full-text search + export |
| `/gateways` | Gateways | Yes | Gateway management |
| `/agents/new` | AgentCreate | Yes | Create/edit agent |
| `/agents/:id` | AgentProfile | Yes | Agent detail page |
| `/settings` | Settings | Yes | Account + org settings |
| `/docs/*` | DocsLayout | No | Documentation portal (8 pages) |

---

## State Management (Zustand)

### auth-store.ts
```typescript
{
  user: { id, email, name } | null
  organization: { id, name, slug } | null
  orgRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login(email, password)     // API call → store tokens + user
  signup(email, password, name, orgName)
  logout()                   // Clear tokens + redirect
  initialize()               // Restore session from localStorage on mount
  setTokens(accessToken, refreshToken)
  clearAuth()
}
```

### agent-store.ts
```typescript
{
  agents: Agent[]
  stats: AgentStats | null
  selectedAgent: Agent | null
  loading: boolean

  fetchAgents()              // GET /api/agents
  fetchStats()               // GET /api/agents/stats (30s poll)
  fetchAgent(id)             // GET /api/agents/:id
  updateAgent(agent)         // Real-time WebSocket sync
}
```

### activity-store.ts
```typescript
{
  activities: Activity[]     // Last 200 in memory
  total: number
  loading: boolean
  filterAgent: string | null
  filterType: ActivityType | null

  fetchActivities(params?)   // GET /api/activities
  addActivity(activity)      // Real-time from WebSocket
  setFilterAgent(id)
  setFilterType(type)
}
```

### task-store.ts
```typescript
{
  tasks: Task[]
  loading: boolean

  fetchTasks()               // GET /api/tasks
  addTask(data)              // POST /api/tasks
  updateTask(id, data)       // PATCH /api/tasks/:id
  deleteTask(id)             // DELETE /api/tasks/:id
  moveTask(id, status)       // Update task status (drag-drop)
  setTask(task)              // Real-time sync
  removeTask(id)             // Real-time sync
}
```

---

## API Client (`src/lib/api.ts`)

Centralized API client with automatic token refresh. Base URL: `/api`.

All API methods are organized by resource:

### api.auth
- `signup(email, password, name, orgName)` → tokens + user
- `login(email, password)` → tokens + user
- `refresh(refreshToken)` → new tokens
- `me()` → current user info

### api.agents
- `list()` / `get(id)` / `stats()` / `create(data)` / `update(id, data)` / `delete(id)`
- `updateConfig(id, { soulMd?, enabled?, heartbeatInterval? })`

### api.tasks
- `list()` / `create(data)` / `update(id, data)` / `delete(id)`

### api.boards
- `list()` / `get(id)` / `create(data)` / `update(id, data)` / `delete(id)`
- `addAgent(boardId, { agentId, isLead? })` / `removeAgent(boardId, agentId)`

### api.boardGroups
- `list()` / `create(name, description?)` / `update(id, data)` / `delete(id)`

### api.approvals
- `list(params?)` / `stats()` / `get(id)` / `create(data)` / `approve(id)` / `reject(id)`

### api.gateways
- `list()` / `get(id)` / `create(name, url, token, workspaceRoot?)` / `update(id, data)` / `delete(id)`
- `health(id)` / `models(id)` / `sessions(id)`

### api.chat
- `history(agentId)` / `send(agentId, message)`

### api.files
- `list(agentId)` / `get(agentId, name)` / `update(agentId, name, content)`

### api.mcp
- `list(agentId)` / `add(agentId, data)` / `update(agentId, serverId, data)` / `remove(agentId, serverId)`
- `refreshTools(agentId, serverId)` / `tools(agentId, serverId)`

### api.activities
- `list(params?)` / `search(query, params?)`

### api.sessions
- `list(params?)` / `timeline()`

### api.tokens
- `usage(params?)` / `summary()`

### api.metrics
- `list(params?)` / `summary()`

### api.alerts
- `rules()` / `createRule(data)` / `updateRule(id, data)` / `events(params?)` / `acknowledge(id)`

### api.commands
- `send({ agentId, type, payload? })` / `list(agentId?)`

### api.org
- `get()` / `update(data)` / `members()` / `invite(email, role)` / `updateMemberRole(id, role)` / `removeMember(id)`
- `apiKeys()` / `createApiKey(name)` / `revokeApiKey(id)`

### api.agentTokens
- `generate(agentId)`

### api.llmProviders
- `list()` / `upsert(provider, mode, apiKey?)` / `delete(id)` / `test(id)` / `usage()`

### Token Refresh
On 401 response, the client automatically attempts to refresh the access token using the stored refresh token. If refresh fails, redirects to `/login`.

---

## Real-Time Updates (Socket.IO)

### Connection
Layout component establishes Socket.IO connection on mount with JWT auth. Joins org-scoped room automatically.

### Events Handled
```
agent:status     → updateAgent in agent-store
agent:heartbeat  → updateAgent in agent-store
activity:new     → addActivity in activity-store
task:update      → setTask in task-store
task:delete      → removeTask in task-store
```

---

## Type Definitions (`src/types/index.ts`)

### Core Types
- **Agent** — id, displayName, status (ONLINE/IDLE/OFFLINE/ERROR), avatar, lastHeartbeat, currentTask, soulMd, gatewayId, boardId, isBoardLead, counts
- **Activity** — type (HEARTBEAT/TASK_START/TASK_COMPLETE/ERROR/MESSAGE/DELEGATION/ALERT/SYSTEM), message, metadata, agent
- **Task** — title, status (BACKLOG/ASSIGNED/IN_PROGRESS/REVIEW/DONE), priority (LOW/MEDIUM/HIGH/CRITICAL), agentId
- **AgentStats** — total, online, idle, offline, error, recentActivities, activeTasks
- **Session** — type, startedAt, endedAt, durationMs, status, summary, tokensUsed, cost
- **Thread** / **Message** — Inter-agent communication
- **TokenUsage** — inputTokens, outputTokens, totalTokens, model, cost
- **MetricSnapshot** — responseTimeMs, success, errorMessage, toolName
- **AlertRule** — condition, threshold, windowMinutes, enabled
- **AlertEvent** — message, severity (INFO/WARNING/CRITICAL), acknowledged
- **Command** — type, payload, status (PENDING/DELIVERED/EXECUTED)
- **Gateway** — name, url, status (ONLINE/OFFLINE/UNKNOWN), hasToken
- **Board** — name, type (goal/sprint/continuous), objective, maxAgents, targetDate, requireApprovalForDone
- **Approval** — status (PENDING/APPROVED/REJECTED), confidence, actionType, payload
- **ChatMessage** — role, content, timestamp
- **WorkspaceFile** — name, path, missing, size, updatedAtMs, content
- **LlmProvider** — provider, mode (BYOK/PLATFORM), isActive
- **McpServer** — name, url, transport (SSE/STREAMABLE_HTTP), enabled, tools
- **CommEdge** — source, target, messageCount, lastMessage

---

## Utility Functions (`src/lib/utils.ts`)

- `cn(...inputs)` — Classname merge (clsx + tailwind-merge)
- `timeAgo(date)` — Relative time string ("5 minutes ago")
- `statusColors` — Agent status → Tailwind bg color classes
- `statusTextColors` — Agent status → text color classes
- `activityTypeColors` — Activity type → color classes
- `activityTypeBgColors` — Activity type → bg + border colors
- `activityTypeIcons` — Activity type → Unicode emoji
- `priorityColors` — Task priority → color classes

---

## Design System

### Color Palette
- **Primary:** `nexus-500/600/700` (blue-based brand color)
- **Surface:** `surface-850/900/950` (dark gray backgrounds)
- **Text:** `white`, `gray-300`, `gray-500`, `gray-600`
- **Status:** `emerald` (online), `amber` (idle), `gray` (offline), `red` (error)
- **Semantic:** `blue`, `violet`, `orange`, `red`, `pink`, `cyan`, `indigo`

### Layout
- **Sidebar:** Fixed left, 264px wide (`w-64`), full height
- **Main content:** `ml-64` with `px-8 pb-8` padding
- **Cards:** `rounded-xl border border-white/5 bg-surface-850 p-5`
- **Grids:** Responsive `grid-cols-2/3/4/5`

### Navigation (Sidebar sections)
1. **Monitor** — Dashboard, Activity, Chat
2. **Manage** — Tasks, Boards, Approvals, Controls
3. **Infrastructure** — Agents, Gateways, Communications
4. **Observe** — Timeline, Topology, Metrics, Alerts, Search
5. **Account** — Settings (bottom)

### Animations
- `animate-pulse-dot` — Pulsing status indicator
- `animate-spin` — Loading spinner
- `animate-glow` — Logo glow effect
- `animate-bounce` — Typing indicator
- Standard transitions: `transition-all duration-200`

---

## Authentication Flow

1. User logs in → `api.auth.login()` → stores refresh token in localStorage
2. Access token stored in Zustand auth-store (memory only)
3. API client auto-injects `Authorization: Bearer <token>` header
4. On 401 → auto-refresh with refresh token → retry original request
5. If refresh fails → `clearAuth()` + redirect to `/login`
6. On app mount → `auth-store.initialize()` restores session from localStorage

---

## Configuration

### vite.config.ts
- React plugin + Tailwind CSS plugin
- Path alias: `@/` → `src/`
- Dev server port: 5174
- Proxy: `/api` and `/socket.io` → `localhost:4000`

### tsconfig.json
- Target: ES2022, strict mode
- JSX: react-jsx
- Path alias: `@/*` → `src/*`

---

## Testing

- **Framework:** Vitest 4.0 with jsdom environment
- **Libraries:** @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
- **Tests:** 60 tests covering utilities, types, API client (mocked fetch), Zustand stores, component rendering
- **Run:** `npm test` or `npm run test:watch`
