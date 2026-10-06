# ── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_SITE_URL
ARG VITE_DEFAULT_OG_IMAGE
ARG VITE_LOCAL_LLM_ENDPOINT
ARG VITE_LOCAL_LLM_MODEL
ARG VITE_LOCAL_LLM_MODELS_JSON
ARG VITE_GATEWAY_ENDPOINT
ARG VITE_MCP_PRESETS_JSON
ARG VITE_DEV_PORT
ARG VITE_BACKEND_URL
ENV VITE_SITE_URL=$VITE_SITE_URL \
    VITE_DEFAULT_OG_IMAGE=$VITE_DEFAULT_OG_IMAGE \
    VITE_LOCAL_LLM_ENDPOINT=$VITE_LOCAL_LLM_ENDPOINT \
    VITE_LOCAL_LLM_MODEL=$VITE_LOCAL_LLM_MODEL \
    VITE_LOCAL_LLM_MODELS_JSON=$VITE_LOCAL_LLM_MODELS_JSON \
    VITE_GATEWAY_ENDPOINT=$VITE_GATEWAY_ENDPOINT \
    VITE_MCP_PRESETS_JSON=$VITE_MCP_PRESETS_JSON \
    VITE_DEV_PORT=$VITE_DEV_PORT \
    VITE_BACKEND_URL=$VITE_BACKEND_URL

# Install Chromium for pre-rendering (Puppeteer)
RUN apk add --no-cache chromium

# Tell Puppeteer to use the installed Chromium instead of downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy monorepo root files for npm workspaces
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install

# Copy frontend source
COPY frontend/ ./frontend/

# Build and pre-render public pages for SEO
RUN npx -w frontend vite build && node frontend/scripts/prerender.mjs

# ── Stage 2: Serve with nginx ──────────────────────────
FROM nginx:alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
