# Nexus AI — Autonomous Agent Fleet Management Platform

<div align="center">

![Nexus AI](https://img.shields.io/badge/Nexus_AI-Multi--Agent_Platform-5367FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDdWMTdMMTIgMjJMMjAgMTdWN0wxMiAyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

**A production-grade platform for provisioning, orchestrating, monitoring, and chatting with autonomous AI agent fleets — powered by OpenClaw Gateway integration.**

[Getting Started](#-quick-start) · [Architecture](#-architecture) · [Features](#-features) · [Documentation](./SETUP_GUIDE.md) · [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🤖 Agent Fleet Management
- **Real Agent Provisioning** via OpenClaw Gateway (WebSocket RPC)
- **Live Chat Console** — converse with agents in real-time
- **Workspace File Editor** — edit SOUL.md, TOOLS.md, IDENTITY.md directly
- **Multi-Gateway Support** — connect to multiple OpenClaw gateway instances

### 📋 Production Chains & Boards
- **Multi-Agent Pipelines** — chain agents into sequential/parallel workflows
- **Kanban Task Boards** — visual task management with drag-and-drop
- **Approval Workflows** — human-in-the-loop approval for critical actions
- **Board Groups** — cross-board coordination and memory sharing

### 📊 Observability & Analytics
- **Real-Time Dashboard** — fleet capacity, token burn, execution success rates
- **Network Topology Graph** — force-directed visualization of agent connections
- **Session Timeline** — Gantt-style view of all agent sessions
- **Token Usage & Cost Analytics** — per-agent, per-model cost tracking
- **Alert System** — configurable rules with severity levels and acknowledgment

### 🧠 Code Intelligence (Sourcegraph-Style)
- **Semantic Code Search** — regex and text search across the entire codebase
- **Symbol Explorer** — browse functions, classes, interfaces with go-to-definition
- **Dependency Graph** — interactive file-level import/export visualization
- **Find References** — locate all imports and usages of any symbol
- **Codebase Statistics** — lines, files, languages, largest files at a glance

### 🔧 Prompt Engineering Lab
- **Structured Prompt Templates** — code review, refactoring, bug detection, completion, explanation
- **Variable Substitution** — fill in `{{language}}`, `{{code}}`, `{{context}}` placeholders
- **Few-Shot Examples** — reference input/output pairs for each template
- **Version History** — track prompt iterations and refinements
- **Test Playground** — render and test prompts against connected LLMs

### 🔐 Enterprise-Ready
- **JWT + API Key Authentication** — secure multi-tenant access
- **Organization Management** — Owner/Admin/Member/Viewer roles
- **BYOK + Platform LLM Keys** — bring your own API keys or use Nexus credits
- **Email Verification** — SMTP-based account verification flow
- **Docker Deployment** — production-ready Dockerfile + docker-compose.yml

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.7, Vite 6.1, Tailwind CSS 4, Zustand, Recharts |
| **Backend** | Express 5, TypeScript, Prisma 6.19 (PostgreSQL), Socket.IO 4.8 |
| **AI Integration** | OpenClaw Gateway (WebSocket RPC), Multi-LLM (OpenAI, Anthropic, Google, etc.) |
| **Observability** | OpenTelemetry (traces, metrics, logs), Pino structured logging |
| **DevOps** | Docker, Docker Compose, Vitest, GitHub Actions |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 20.x
- **PostgreSQL** ≥ 14
- **npm** ≥ 10.x

### 1. Clone & Install
```bash
git clone https://github.com/your-team/nexus-ai.git
cd nexus-ai
npm install
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database URL, JWT secrets, etc.
```

### 3. Set Up Database
```bash
cd backend
npx prisma migrate dev
npx tsx prisma/seed.ts
```

### 4. Run Development Servers
```bash
# From project root — starts both backend (port 4000) and frontend (port 5173)
npm run dev
```

### 5. Open in Browser
Navigate to **http://localhost:5173**

> For detailed setup instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 🏗 Architecture

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
         │ REST + Socket.IO
         │
┌────────┴─────────┐
│  Nexus Frontend  │
│  (React+Vite)    │
│  Dashboard, Chat,│
│  Boards, Code    │
│  Intelligence    │
└──────────────────┘
```

---

## 📁 Project Structure

```
nexus-ai/
├── backend/
│   ├── prisma/          # Database schema & migrations
│   ├── src/
│   │   ├── routes/      # Express REST endpoints (31 route files)
│   │   ├── services/    # Business logic layer (39 service files)
│   │   ├── prompts/     # Prompt engineering templates
│   │   ├── openclaw/    # Gateway WebSocket RPC client
│   │   ├── middleware/  # Auth, rate limiting, API key validation
│   │   ├── websocket/   # Socket.IO real-time event handling
│   │   ├── lib/         # Shared utilities (logger, prisma, email)
│   │   └── test/        # Vitest test suites (9 test files)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/       # 29 page components + docs + landing
│   │   ├── components/  # Reusable UI components
│   │   ├── lib/         # API client, design system, utilities
│   │   ├── stores/      # Zustand state management
│   │   └── types/       # TypeScript type definitions
│   └── Dockerfile
├── docker-compose.yml   # Full stack deployment
├── SETUP_GUIDE.md       # Detailed setup instructions
├── TOOLING.md           # Tool configuration reference
├── PROMPT_ENGINEERING.md # Prompt engineering documentation
├── SOURCEGRAPH_SETUP.md # Sourcegraph OSS setup guide
└── PROJECT_SYNOPSIS.md  # Project charter & scope
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Complete development environment setup |
| [TOOLING.md](./TOOLING.md) | Tool configurations (Vite, Prisma, Docker, etc.) |
| [PROJECT_SYNOPSIS.md](./PROJECT_SYNOPSIS.md) | Project charter and scope definition |
| [PROJECT_TIMELINE.md](./PROJECT_TIMELINE.md) | Milestone timeline and evaluation schedule |
| [TEAM_MATRIX.md](./TEAM_MATRIX.md) | Team roles and responsibility matrix |
| [PROMPT_ENGINEERING.md](./PROMPT_ENGINEERING.md) | Prompt engineering patterns and templates |
| [SOURCEGRAPH_SETUP.md](./SOURCEGRAPH_SETUP.md) | Sourcegraph OSS integration guide |
| [DESIGN_BLUEPRINT.md](./DESIGN_BLUEPRINT.md) | UI/UX design system and wireframes |
| [backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md) | Backend architecture deep dive |
| [frontend/ARCHITECTURE.md](./frontend/ARCHITECTURE.md) | Frontend architecture deep dive |

---

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Run specific test file
cd backend && npx vitest run src/test/api.test.ts
```

---

## 🐳 Docker Deployment

```bash
docker-compose up -d
```

This starts:
- **nexus-backend** on port 4000
- **nexus-frontend** on port 80 (nginx)
- **PostgreSQL** on port 5432

---

## 👥 Team

| Role | Responsibility |
|------|---------------|
| **Backend Lead** | API design, Prisma schema, Gateway integration, services |
| **Frontend Lead** | React pages, UI/UX, design system, component library |
| **AI/ML Engineer** | Prompt engineering, LLM integration, code intelligence |
| **DevOps** | Docker, CI/CD, deployment, monitoring |
| **Documentation** | Setup guides, API docs, project documentation |

---

## 📄 License

This project is developed as part of the AIDevOps curriculum.
