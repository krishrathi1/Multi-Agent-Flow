# Setup Guide — Nexus AI

Complete guide for setting up the Nexus AI development environment.

---

## Prerequisites

| Tool | Version | Installation |
|------|---------|-------------|
| **Node.js** | ≥ 20.x | [nodejs.org](https://nodejs.org/) |
| **npm** | ≥ 10.x | Comes with Node.js |
| **PostgreSQL** | ≥ 14 | [postgresql.org](https://www.postgresql.org/download/) |
| **Git** | ≥ 2.30 | [git-scm.com](https://git-scm.com/) |
| **Docker** (optional) | ≥ 24.x | [docker.com](https://www.docker.com/) |

---

## 1. Clone the Repository

```bash
git clone https://github.com/your-team/nexus-ai.git
cd nexus-ai
```

## 2. Install Dependencies

```bash
# Install all workspaces (backend + frontend) from project root
npm install
```

This uses npm workspaces to install both `backend/` and `frontend/` dependencies in a single command.

## 3. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string: `postgresql://user:pass@localhost:5432/nexus` |
| `JWT_SECRET` | ✅ | Secret for access tokens (min 32 chars). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | ✅ | Secret for refresh tokens (min 32 chars) |
| `ENCRYPTION_KEY` | ✅ | AES-256 key for encrypting API keys at rest (64 hex chars) |
| `PORT` | ❌ | Backend port (default: 4000) |
| `CORS_ORIGINS` | ❌ | Allowed frontend origins (default: `http://localhost:5173,http://localhost:5174`) |
| `SMTP_HOST` | ❌ | SMTP host for email verification |
| `SMTP_PORT` | ❌ | SMTP port (default: 587) |
| `SMTP_USER` | ❌ | SMTP username |
| `SMTP_PASS` | ❌ | SMTP password |
| `APP_URL` | ❌ | Frontend URL for email links (default: `http://localhost:5174`) |

### Quick Start (Minimal .env)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nexus"
JWT_SECRET=your-32-char-secret-here-for-jwt-tokens
JWT_REFRESH_SECRET=your-32-char-secret-here-for-refresh
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

## 4. Set Up the Database

### Create the database
```bash
# Using psql
createdb nexus
# Or: psql -c "CREATE DATABASE nexus;"
```

### Run migrations
```bash
cd backend
npx prisma migrate dev
```

### Seed with sample data
```bash
cd backend
npx tsx prisma/seed.ts
```

### (Optional) Open Prisma Studio
```bash
cd backend
npx prisma studio
# Opens at http://localhost:5555
```

## 5. Run the Development Servers

### Option A: Both servers (recommended)
```bash
# From project root
npm run dev
```

This uses `concurrently` to start both:
- **Backend** at `http://localhost:4000` (tsx watch mode with hot reload)
- **Frontend** at `http://localhost:5173` (Vite HMR)

### Option B: Separately
```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

## 6. Open the Application

Navigate to **http://localhost:5173** in your browser.

1. Click **"Get Started"** to sign up
2. Enter your email and password
3. (If SMTP is not configured, check the backend logs for the verification link)
4. You'll be redirected to the Dashboard

---

## Running Tests

### Backend Tests
```bash
cd backend
npm test            # Run all tests once
npm run test:watch  # Watch mode
```

### Frontend Tests
```bash
cd frontend
npm test            # Run all tests once
npm run test:watch  # Watch mode
```

### Specific Test File
```bash
cd backend
npx vitest run src/test/api.test.ts
```

---

## Docker Deployment

### Full Stack with Docker Compose
```bash
docker-compose up -d
```

This starts:
- `nexus-backend` on port 4000
- `nexus-frontend` on port 80 (nginx)
- `nexus-db` (PostgreSQL) on port 5432

### Build Individual Images
```bash
# Backend
cd backend && docker build -t nexus-backend .

# Frontend
cd frontend && docker build -t nexus-frontend .
```

---

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` in `.env` matches your PostgreSQL configuration
- Ensure the database exists: `psql -l | grep nexus`

### "JWT_SECRET is required"
- Generate secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Add to `backend/.env`

### "CORS error" in browser
- Check `CORS_ORIGINS` in `.env` includes your frontend URL
- Default: `http://localhost:5173,http://localhost:5174`

### "Email verification not working"
- Configure SMTP settings in `.env` or check backend logs for the verification link
- For development, the seed script creates a pre-verified admin account

### Prisma migration errors
```bash
cd backend
npx prisma migrate reset --force   # Reset and re-apply all migrations
npx tsx prisma/seed.ts              # Re-seed data
```
