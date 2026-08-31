# ── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy monorepo root files for npm workspaces
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all deps (workspace-aware)
RUN npm install

# Copy backend source + prisma
COPY backend/prisma ./backend/prisma/
RUN npx -w backend prisma generate

COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/
RUN npm run build -w backend

# ── Stage 2: Production ────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY backend/prisma ./backend/prisma/

RUN npm install -w backend --omit=dev && npx -w backend prisma generate

# Copy built output
COPY --from=builder /app/backend/dist ./backend/dist/

WORKDIR /app/backend

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node --import ./dist/instrumentation.js dist/index.js"]
