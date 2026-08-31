# Sourcegraph Setup Guide — Nexus AI

This document covers two approaches to code intelligence:

1. **Built-in Code Intelligence** (already integrated in Nexus)
2. **External Sourcegraph OSS** (Docker-based, for advanced cross-repository search)

---

## 1. Built-in Code Intelligence (Nexus Feature)

Nexus includes a built-in Code Intelligence module at `/code-intelligence` that provides:

### Features
- **Semantic Code Search** — Regex and text search across the entire Nexus codebase
- **Symbol Explorer** — Browse all functions, classes, interfaces, types, and enums with go-to-definition
- **Dependency Graph** — Interactive file-level visualization of import/export relationships
- **Find References** — Locate all imports and usages of any symbol across the codebase
- **Codebase Statistics** — Total files, lines, languages, directories, and largest files

### How It Works
The backend service (`backend/src/services/code-intelligence.service.ts`) performs:
1. **File Scanning** — Recursively walks the project tree, collecting `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.prisma`, and `.md` files
2. **Symbol Extraction** — Uses regex heuristics to extract function declarations, classes, interfaces, types, enums, and exported constants
3. **Import/Export Analysis** — Parses `import` statements to build a file-level dependency graph
4. **Full-Text Search** — Searches across all indexed files with optional regex support and file/language filters
5. **Reference Tracking** — Finds all files that import or reference a given symbol name

### API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/code-intelligence/search?q=<query>` | Semantic code search |
| `GET /api/code-intelligence/symbols?kind=function&q=create` | Symbol listing with filters |
| `GET /api/code-intelligence/file/<path>` | File content with metadata |
| `GET /api/code-intelligence/references/<symbol>` | Cross-file reference lookup |
| `GET /api/code-intelligence/graph` | Dependency graph (nodes + edges) |
| `GET /api/code-intelligence/stats` | Codebase statistics |
| `POST /api/code-intelligence/reindex` | Force re-index |

### Query Formulation Examples

| Query | Purpose | Example |
|-------|---------|---------|
| `createAgent` | Find all references to agent creation | Exact text search |
| `router.get` | Find all GET route handlers | Pattern-based search |
| `prisma\.agent` | Find all Prisma agent queries (regex) | Regex with `.` escaped |
| `async function.*Service` | Find all service functions (regex) | Regex with wildcard |
| File filter: `routes` | Search only in route files | Combined with any query |
| Language: `TypeScript` | Search only TypeScript files | Combined with any query |

---

## 2. Sourcegraph OSS (External Setup)

For enterprise-scale cross-repository code search, Sourcegraph OSS can be deployed alongside Nexus.

### Prerequisites
- Docker and Docker Compose
- At least 4 GB RAM available
- At least 10 GB disk space

### Step 1: Deploy Sourcegraph OSS

```bash
# Create a directory for Sourcegraph data
mkdir -p ~/.sourcegraph/config
mkdir -p ~/.sourcegraph/data

# Run Sourcegraph OSS container
docker run -d \
  --name sourcegraph \
  --restart=always \
  -p 7080:7080 \
  -p 127.0.0.1:3370:3370 \
  -v ~/.sourcegraph/config:/etc/sourcegraph \
  -v ~/.sourcegraph/data:/var/opt/sourcegraph \
  sourcegraph/server:5.3.2
```

### Step 2: Configure Sourcegraph

1. Open **http://localhost:7080** in your browser
2. Create an admin account
3. Go to **Site Admin → Manage code hosts**
4. Add your Git repositories:

```json
{
  "url": "https://github.com",
  "token": "<your-github-pat>",
  "repos": [
    "your-team/nexus-ai"
  ]
}
```

For local Git repos, use the local clone approach:

```json
{
  "url": "/path/to/repos",
  "repos": [
    {"name": "nexus-ai", "uri": "/path/to/nexus-ai"}
  ]
}
```

### Step 3: Wait for Indexing

Sourcegraph will clone and index all configured repositories. You can monitor progress at:
- **http://localhost:7080/site-admin/repositories**

### Step 4: Create an API Token

1. Go to **Settings → Access Tokens**
2. Create a token with `site-admin:sudo` scope
3. Save the token — you'll use it for API access

### Step 5: Query Formulation

#### Basic Search
```
repo:nexus-ai createAgent
```

#### Structural Search
```
repo:nexus-ai lang:typescript router.get(...)
```

#### Regex Search
```
repo:nexus-ai /async function \w+Service/
```

#### Symbol Search
```
repo:nexus-ai type:symbol GatewayClient
```

#### Diff Search (What Changed)
```
repo:nexus-ai type:diff after:"1 week ago" prisma
```

#### Commit Search
```
repo:nexus-ai type:commit "fix bug"
```

### Step 6: Add to Nexus docker-compose.yml (Optional)

```yaml
services:
  # ... existing services ...

  sourcegraph:
    image: sourcegraph/server:5.3.2
    ports:
      - "7080:7080"
      - "3370:3370"
    volumes:
      - sourcegraph-config:/etc/sourcegraph
      - sourcegraph-data:/var/opt/sourcegraph
    restart: always
    deploy:
      resources:
        limits:
          memory: 4G

volumes:
  sourcegraph-config:
  sourcegraph-data:
```

---

## 3. Comparison: Built-in vs Sourcegraph OSS

| Feature | Built-in Code Intelligence | Sourcegraph OSS |
|---------|---------------------------|-----------------|
| **Setup** | Zero config (runs on Nexus backend) | Requires Docker + indexing |
| **Search Speed** | Milliseconds (in-memory) | Milliseconds (trigram index) |
| **Cross-Repo Search** | Single project only | Multiple repositories |
| **Symbol Navigation** | Regex-based extraction | Full AST/LSIF precision |
| **Go-to-Definition** | File + line level | Exact symbol level |
| **Find References** | Import + usage tracking | Complete graph |
| **Language Support** | TS/JS/JSON/CSS/Prisma/MD | 40+ languages |
| **Code Monitoring** | No | Saved searches + alerts |
| **Batch Changes** | No | Yes (large-scale refactors) |
| **Best For** | Quick project-level exploration | Enterprise multi-repo navigation |

---

## 4. VS Code Integration

### Sourcegraph Extension
Install the Sourcegraph VS Code extension for in-editor code intelligence:

```bash
code --install-extension sourcegraph.sourcegraph
```

Configure in `.vscode/settings.json`:
```json
{
  "sourcegraph.url": "http://localhost:7080",
  "sourcegraph.accessToken": "<your-token>"
}
```

This enables:
- **Cmd+Shift+8** — Search across all indexed repos from VS Code
- **Go to Definition** — Jump to definitions in any indexed repository
- **Find References** — Find all references across repositories
