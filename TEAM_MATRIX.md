# Team Responsibility Matrix — Nexus AI

## RACI Matrix

> **R** = Responsible (does the work)  
> **A** = Accountable (owns the outcome)  
> **C** = Consulted (provides input)  
> **I** = Informed (kept updated)

| Deliverable | Member 1 | Member 2 | Member 3 | Member 4 | Member 5 |
|-------------|----------|----------|----------|----------|----------|
| **Backend API & Services** | **R/A** | C | I | C | I |
| **Prisma Schema & Migrations** | **R/A** | I | I | C | I |
| **OpenClaw Gateway Integration** | **R/A** | C | I | I | I |
| **Frontend Pages & Components** | C | **R/A** | C | I | I |
| **UI/UX Design & Styling** | I | **R/A** | I | I | C |
| **Code Intelligence Module** | C | C | **R/A** | I | I |
| **Prompt Engineering Templates** | I | I | **R/A** | C | I |
| **Sourcegraph Setup & Docs** | I | I | **R/A** | C | I |
| **Docker & Deployment** | C | I | I | **R/A** | I |
| **GitHub Actions CI/CD** | I | I | I | **R/A** | C |
| **Testing (Vitest + E2E)** | C | C | I | **R/A** | I |
| **Project Documentation** | I | I | C | I | **R/A** |
| **README & Setup Guide** | C | I | I | I | **R/A** |
| **Synopsis & Timeline** | C | C | C | C | **R/A** |
| **Presentation & Demo** | C | C | C | C | **R/A** |

---

## Role Assignments

| Role | Name | Responsibilities |
|------|------|-----------------|
| **Backend Lead** | *[Name 1]* | Express API routes, Prisma services, Gateway RPC client, agent lifecycle, WebSocket events, authentication |
| **Frontend Lead** | *[Name 2]* | React pages, component library, design system, responsive layouts, state management (Zustand), API integration |
| **AI/ML Engineer** | *[Name 3]* | Code Intelligence service, prompt engineering templates, LLM integration, semantic search, symbol extraction |
| **DevOps Engineer** | *[Name 4]* | Docker configuration, CI/CD pipelines, test infrastructure, deployment automation, monitoring setup |
| **Documentation Lead** | *[Name 5]* | Project synopsis, timeline, setup guides, API documentation, presentation materials, team coordination |

> **Note:** Replace *[Name X]* with actual team member names.

---

## Individual Contribution Tracker

Track each member's contributions for evaluation criteria C5 (Individual Understanding) and C10 (Individual Contribution).

| Week | Member 1 | Member 2 | Member 3 | Member 4 | Member 5 |
|------|----------|----------|----------|----------|----------|
| Aug 1–8 | Project setup, Prisma schema | React scaffold, routing | Research: Sourcegraph API | Docker setup | Project charter draft |
| Aug 8–15 | Auth system, JWT | Login/Signup pages | LLM provider research | docker-compose.yml | README draft |
| Aug 15–23 | Agent CRUD, Gateway client | Dashboard, Metrics pages | Prompt template design | Vitest setup | Architecture docs |
| Aug 24–30 | Chat service, Board service | Chat page, Boards page | Code Intelligence service | Test suite expansion | Synopsis, Timeline, Team Matrix |
| Sep 1–7 | Approval workflow | Approval page, Custom Fields | Code Intelligence frontend | CI/CD pipeline | Sourcegraph docs, Setup guide |
| Sep 8–14 | Production chains | Process pages | Prompt Playground page | E2E tests | TOOLING.md, polish |
| Sep 15–21 | Bug fixes, polish | UI polish, animations | Final code intel polish | Deployment testing | Presentation prep |

---

## Communication & Workflow

- **Version Control**: Git with feature branches, pull requests, code review
- **Task Management**: GitHub Issues + Project board
- **Communication**: Team group chat (WhatsApp/Discord)
- **Meetings**: Weekly sync (30 min) + ad-hoc pair programming
- **Documentation**: Markdown files in repo root, continuously updated
