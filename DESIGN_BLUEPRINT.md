# Nexus AI — Complete Product Design Blueprint & Groww-Style Architecture

## 1. Vision & Metaphor
**Groww** revolutionized retail finance by stripping away clutter and replacing it with clean cards, instant portfolio health indicators, 1-click execution, intuitive tabs (Explore vs Holdings/Invested), and transparent wallet mechanics.

Applying this exact mental model to **Nexus AI** creates the definitive **Autonomous Agent Fleet Super-App**:
- Complex agent networks, pipelines, token costs, and OpenClaw gateways become as effortless and rewarding to manage as a high-performing investment portfolio.

---

## 2. Streamlined 7-Hub Navigation Structure

| # | Hub Name | Route | Groww Equivalent | Core Purpose |
|---|---|---|---|---|
| **1** | **Fleet Overview** | `/dashboard` | Portfolio / Home | Hero metrics, active production swarms, top performing agents, quick actions. |
| **2** | **Productions & Studio** | `/productions` | F&O / Multi-Leg Strategy | Multi-agent chains, Kanban task boards, cron & event triggers. |
| **3** | **Agents & Gateways** | `/agents` | Assets & Stocks Holdings | Agent fleet roster, live chat console, Soul/Tools file editor, OpenClaw nodes. |
| **4** | **Executions & Approvals** | `/activity` | Order Book & Transactions | Live WebSocket step stream, 1-click pending approvals, execution run traces. |
| **5** | **Explore & Marketplace** | `/explore` | Explore / Mutual Fund Store | Pre-built agent archetypes, 1-click skill marketplace, MCP tool registry. |
| **6** | **Observability & Graph** | `/observability` | Technical Charts & Analytics | Token burn telemetry, force-directed topology graph, session timeline, alert rules. |
| **7** | **Wallet & Settings** | `/settings` | Groww Wallet & Account | Nexus credits balance, BYOK encrypted keys, team roles, API tokens. |

---

## 3. High-Conversion Page Blueprints

### 3.1 Fleet Overview (`/dashboard`)
```
+---------------------------------------------------------------------------------------------------+
|  [N] Nexus AI        [ 🔍 Search agents, productions, runs (Cmd+K) ]      [$124.50]  [🔔 (2)] [Avatar]|
+---------------------------------------------------------------------------------------------------+
|  [ Fleet Overview ] [ Productions ] [ Agents ] [ Executions ] [ Explore ] [ Observability ]       |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ ⚡ FLEET CAPACITY ]          [ 💰 24H TOKEN BURN ]        [ 🎯 EXECUTION SUCCESS ]              |
|  14 Agents (9 Online)          $18.42 (-12% vs yest)        99.4% (+0.2% today)                   |
|  🟢 68% active throughput      2.4M tokens processed        1,420 runs (8 errors)                 |
|                                                                                                   |
|  QUICK ACTIONS:  [ + Deploy Agent ]  [ ⚡ New Production ]  [ 🛡️ Approvals (2) ]  [ 💬 Quick Chat ] |
|                                                                                                   |
|  +-------------------------------------------------------------+ +------------------------------+ |
|  | ACTIVE PRODUCTIONS (Running Swarms)             [Manage >]  | | PENDING APPROVALS (2)  [All>]| |
|  | +---------------------------------------------------------+ | | +--------------------------+ | |
|  | | 🟣 Full-Stack Refactor Swarm        [ ACTIVE ]  85% done  | | | | Agent: DevOps-Bot        | | |
|  | | 4 Agents: Architect ➔ Coder ➔ Tester ➔ Reviewer         | | | | Action: Deploy to Staging| | |
|  | +---------------------------------------------------------+ | | | [✓ Approve]   [✕ Reject] | | |
|  | | 🟢 Growth Research Swarm            [ ACTIVE ]  42% done  | | | +--------------------------+ | |
|  | | 2 Agents: WebScraper ➔ DataAnalyst                      | | |                              | |
|  | +---------------------------------------------------------+ | | GATEWAY STATUS: 3/3 Healthy  | |
|  +-------------------------------------------------------------+ +------------------------------+ |
+---------------------------------------------------------------------------------------------------+
```

### 3.2 Agent Detail Inspector (Groww Stock Sheet Modal)
```
+---------------------------------------------------------------------------------------------------+
|  [🤖 Lead-Architect-01]  🟢 Online · GPT-4.5 · OpenClaw Node #1         [ Pause ] [ Settings ] [ X ]|
+---------------------------------------------------------------------------------------------------+
|  [ 💬 Live Chat & Console ] [ 📝 Soul & Tools (SOUL.md) ] [ 📊 Runs & Traces ] [ ⚡ Telemetry ]   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  CHAT STREAM:                                                                                     |
|  [11:15 AM] User: "Analyze the database schema for migration bottlenecks."                        |
|  [11:15 AM] Agent (Thinking): Inspecting schema.prisma and indexing strategies...                |
|  [11:16 AM] Agent: "Found 2 unindexed foreign keys in TokenUsage table. Prepared a migration."   |
|                                                                                                   |
|  [ Send message to agent...                                                          ] [ Send ➔ ] |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Figma Design Tokens & Visual Language

- **Primary Accent (Groww Emerald)**: `#00D09C` (Online, High Success, Primary CTAs)
- **Secondary Accent (Indigo Glow)**: `#5367FF` (Agent Intelligence, Swarms)
- **Tooling Cyan**: `#06B6D4` (Gateways & MCP)
- **Card Backgrounds**: `#111722` (Dark) / `#FFFFFF` (Light)
- **Borders**: `#1E293B` (Dark) / `#E2E8F0` (Light)
- **Card Radius**: `16px` (`rounded-2xl`)
- **Metric Typography**: `Inter` / `Outfit` tabular numerical styling
