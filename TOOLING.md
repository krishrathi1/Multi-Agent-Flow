# Tooling Reference — Nexus AI

Configuration and usage guide for all development tools in the Nexus AI project.

---

## Vite (Frontend Build Tool)

**Config:** `frontend/vite.config.ts`

### Key Settings
- **Dev server port:** 5173 (default)
- **API proxy:** `/api` → `http://localhost:4000` (avoids CORS in development)
- **Socket.IO proxy:** `/socket.io` → `ws://localhost:4000`
- **Hot Module Replacement (HMR):** Enabled by default — changes reflect instantly
- **Build output:** `frontend/dist/`

### Commands
```bash
cd frontend
npm run dev         # Start dev server with HMR
npm run build       # Production build (TypeScript check + Vite build + prerender)
npm run build:no-prerender  # Build without prerendering
npm run preview     # Preview production build locally
```

---

## Vitest (Testing Framework)

**Backend config:** `backend/vitest.config.ts`  
**Frontend config:** `frontend/vitest.config.ts`

### Backend Testing
- Environment: Node.js
- Mock setup: `backend/src/test/setup.ts` — configures Prisma mock, test utilities
- Test files: `backend/src/test/*.test.ts`

### Frontend Testing
- Environment: jsdom
- Libraries: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
- Test files: `frontend/src/test/*.test.tsx`

### Commands
```bash
npm test                    # Run all tests
npx vitest run              # Run once (CI mode)
npx vitest                  # Watch mode
npx vitest run --coverage   # With coverage report
npx vitest run src/test/api.test.ts  # Specific file
```

---

## Prisma (ORM & Database Toolkit)

**Schema:** `backend/prisma/schema.prisma`  
**Migrations:** `backend/prisma/migrations/`

### Workflow
```bash
cd backend

# After editing schema.prisma:
npx prisma migrate dev --name <description>  # Create + apply migration

# Reset everything (destructive):
npx prisma migrate reset --force

# Apply migrations (production):
npx prisma migrate deploy

# Generate Prisma Client (auto-runs after migrate):
npx prisma generate

# Interactive database browser:
npx prisma studio

# Seed database:
npx tsx prisma/seed.ts
```

### Schema Highlights
- **45+ models** covering agents, boards, approvals, tasks, gateways, etc.
- **Multi-tenant:** All entities scoped to `organizationId`
- **Soft relations:** Optional foreign keys for graceful degradation
- **JSON fields:** Used for metadata, success metrics, custom field values

---

## TypeScript

**Backend config:** `backend/tsconfig.json`  
**Frontend config:** `frontend/tsconfig.json`

### Key Settings (Backend)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist"
  }
}
```

### Type Checking
```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend (includes tsconfig.node.json for Vite config)
cd frontend && npx tsc -b
```

---

## Docker

**Backend Dockerfile:** `backend/Dockerfile`  
**Frontend Dockerfile:** `frontend/Dockerfile`  
**Compose:** `docker-compose.yml`

### Architecture
- **Backend:** Multi-stage build (Node.js 20 Alpine → Prisma generate → production slim image)
- **Frontend:** Build stage (Node.js + Vite build) → Serve stage (nginx Alpine)
- **Database:** PostgreSQL 14 Alpine

### Commands
```bash
# Start everything
docker-compose up -d

# Rebuild after changes
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop
docker-compose down

# Stop + remove volumes (deletes database!)
docker-compose down -v
```

---

## Socket.IO (Real-Time Communication)

**Server:** `backend/src/websocket/index.ts`  
**Client:** `frontend/src/lib/socket.ts`

### Events Emitted by Backend
| Event | Payload | Description |
|-------|---------|-------------|
| `agent:created` | Agent object | New agent provisioned |
| `agent:updated` | Agent object | Agent config changed |
| `agent:status` | `{ id, status }` | Agent status change |
| `agent:heartbeat` | `{ id, status }` | Agent heartbeat received |
| `activity:new` | Activity object | New activity logged |
| `task:updated` | Task object | Task status change |

### Connection
The frontend connects automatically on mount:
```typescript
import { getSocket } from '../lib/socket';
const socket = getSocket();
socket.on('agent:status', (data) => { /* handle */ });
```

---

## OpenTelemetry (Observability)

**Config:** `backend/src/instrumentation.ts`

### Components
- **Traces:** HTTP request spans via `@opentelemetry/instrumentation-http`
- **Metrics:** Custom counters and histograms via `@opentelemetry/sdk-metrics`
- **Logs:** Pino logger with OpenTelemetry transport

### Exporters
All configured via environment variables:
```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=nexus-backend
```

---

## Pino (Structured Logging)

**Config:** `backend/src/lib/logger.ts`

### Log Levels
- `trace` — Extremely verbose debugging
- `debug` — Development debugging
- `info` — Normal operation (default)
- `warn` — Recoverable issues
- `error` — Failures requiring attention
- `fatal` — Unrecoverable errors

### Usage
```typescript
import { logger } from './lib/logger';
logger.info({ userId, agentId }, 'Agent created');
logger.error({ err }, 'Gateway connection failed');
```

---

## Playwright (End-to-End Testing)

**Config:** `e2e/` directory  
**Dependency:** `@playwright/test` in root `package.json`

### Commands
```bash
npx playwright install  # Install browsers
npx playwright test     # Run E2E tests
npx playwright test --headed  # With browser visible
```
