#!/usr/bin/env bash
# Keeps the public backend URL working when the Cloudflare quick tunnel dies.
#
# A quick tunnel's *.trycloudflare.com address is deleted by Cloudflare if the
# connection drops for a few minutes; reconnecting doesn't bring it back, and
# Vercel's rewrites keep pointing at the dead name. Run from cron every minute:
#
#   1. backend down locally      -> do nothing (pm2 restarts the backend)
#   2. tunnel address unhealthy  -> after N straight failures, restart the tunnel
#   3. Vercel points elsewhere   -> rewrite vercel.json and redeploy production
#
# Settings come from /etc/maf-watchdog.env. VERCEL_TOKEN is required for step 3;
# without it the new address is only logged.

set -uo pipefail

[ -f /etc/maf-watchdog.env ] && . /etc/maf-watchdog.env

APP_DIR=${APP_DIR:-/var/www/multi-agent-flow}
TUNNEL_PROC=${TUNNEL_PROC:-nexus-tunnel}
BACKEND_LOCAL=${BACKEND_LOCAL:-http://127.0.0.1:4000}
SITE_URL=${SITE_URL:-https://multi-agent-flow.vercel.app}
STATE_DIR=${STATE_DIR:-/var/lib/maf-watchdog}
FAILS_BEFORE_RESTART=${FAILS_BEFORE_RESTART:-3}
MIN_DEPLOY_INTERVAL=${MIN_DEPLOY_INTERVAL:-600}
VERCEL_TOKEN=${VERCEL_TOKEN:-}

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0 # previous run still going

log() { echo "$(date -Is) $*"; }
healthy() { curl -sf -m 15 "$1/api/health" 2>/dev/null | grep -q '"ok"'; }
now() { date +%s; }

# The quick tunnel reports its hostname on cloudflared's local metrics port.
tunnel_host() {
  local pid port host
  pid=$(pm2 pid "$TUNNEL_PROC" 2>/dev/null | tail -1)
  [ -n "$pid" ] && [ "$pid" != "0" ] || return 1
  for port in $(ss -ltnp 2>/dev/null | grep "pid=$pid," | grep -oE '127\.0\.0\.1:[0-9]+' | cut -d: -f2); do
    host=$(curl -s -m 3 "http://127.0.0.1:$port/quicktunnel" | grep -oE '[a-z0-9-]+\.trycloudflare\.com')
    [ -n "$host" ] && { echo "$host"; return 0; }
  done
  return 1
}

configured_host() {
  grep -oE '[a-z0-9-]+\.trycloudflare\.com' "$APP_DIR/frontend/vercel.json" | head -1
}

restart_tunnel() {
  log "restarting $TUNNEL_PROC"
  pm2 restart "$TUNNEL_PROC" >/dev/null
  local i host
  for i in $(seq 1 30); do # new address registers within a few seconds…
    sleep 3
    host=$(tunnel_host) && break
  done
  [ -n "${host:-}" ] || { log "tunnel came back without an address"; return 1; }
  for i in $(seq 1 30); do # …and starts routing within a minute or two
    healthy "https://$host" && { log "tunnel healthy at $host"; return 0; }
    sleep 5
  done
  log "new address $host never became healthy"
  return 1
}

point_vercel_at() {
  local host=$1 old
  old=$(configured_host)
  if [ -z "$VERCEL_TOKEN" ]; then
    log "Vercel still points at $old; set VERCEL_TOKEN in /etc/maf-watchdog.env to redeploy with $host"
    return 1
  fi
  local last=0
  [ -f "$STATE_DIR/last_deploy" ] && last=$(cat "$STATE_DIR/last_deploy")
  if [ $(( $(now) - last )) -lt "$MIN_DEPLOY_INTERVAL" ]; then
    log "deploy skipped: last one was under ${MIN_DEPLOY_INTERVAL}s ago"
    return 1
  fi
  now > "$STATE_DIR/last_deploy"

  sed -i "s/[a-z0-9-]*\.trycloudflare\.com/$host/g" "$APP_DIR/vercel.json" "$APP_DIR/frontend/vercel.json"
  log "deploying Vercel with $host (was $old)"
  if (cd "$APP_DIR" && vercel deploy --prod --yes --token "$VERCEL_TOKEN" >"$STATE_DIR/deploy.log" 2>&1); then
    sleep 10
    if healthy "$SITE_URL"; then log "site healthy through Vercel"; else log "deployed, but $SITE_URL/api/health still failing"; fi
  else
    log "vercel deploy failed: $(tail -3 "$STATE_DIR/deploy.log" | tr '\n' ' ')"
    # Put the old address back so the next run sees the mismatch and retries.
    [ -n "$old" ] && sed -i "s/$host/$old/g" "$APP_DIR/vercel.json" "$APP_DIR/frontend/vercel.json"
    return 1
  fi
}

# 1. A dead backend isn't a tunnel problem.
if ! healthy "$BACKEND_LOCAL"; then
  log "backend not answering locally; leaving the tunnel alone"
  exit 0
fi

# 2. Is the tunnel's public address alive?
host=$(tunnel_host || true)
if [ -n "$host" ] && healthy "https://$host"; then
  echo 0 > "$STATE_DIR/fails"
else
  fails=$(( $(cat "$STATE_DIR/fails" 2>/dev/null || echo 0) + 1 ))
  echo "$fails" > "$STATE_DIR/fails"
  log "tunnel check failed ($fails/$FAILS_BEFORE_RESTART) host=${host:-none}"
  [ "$fails" -ge "$FAILS_BEFORE_RESTART" ] || exit 0
  echo 0 > "$STATE_DIR/fails"
  restart_tunnel || exit 1
  host=$(tunnel_host) || exit 1
fi

# 3. Does Vercel point at it?
if [ "$host" != "$(configured_host)" ]; then
  point_vercel_at "$host"
fi
