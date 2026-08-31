#!/bin/bash
BASE=http://localhost:4000
PASS=0
FAIL=0
ERRORS=""
TS=$(date +%s)  # timestamp for unique names

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
  local name="$1"
  local response="$2"
  local expected="$3"
  if echo "$response" | grep -qE "$expected"; then
    echo -e "  ${GREEN}PASS${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $name"
    echo -e "    Response: $(echo "$response" | head -c 300)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $name"
  fi
}

check_status() {
  local name="$1"
  local status="$2"
  local expected="$3"
  if [ "$status" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} $name (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $name (expected HTTP $expected, got $status)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  - $name"
  fi
}

# ============ LOGIN ============
echo -e "\n${YELLOW}=== LOGIN ===${NC}"
LOGIN_RESP=$(curl -s -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@nexus.local","password":"TestPass123"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
check "Login successful" "$LOGIN_RESP" "accessToken"

AUTH="Authorization: Bearer $TOKEN"

AGENT_ID=$(curl -s $BASE/api/agents -H "$AUTH" | python3 -c "import sys,json; a=json.load(sys.stdin); print(a[0]['id'] if a else '')" 2>/dev/null)
GATEWAY_ID=$(curl -s $BASE/api/gateways -H "$AUTH" | python3 -c "import sys,json; g=json.load(sys.stdin); print(g[0]['id'] if g else '')" 2>/dev/null)
echo "  Agent ID: ${AGENT_ID:0:12}..."
echo "  Gateway ID: ${GATEWAY_ID:0:12}..."

# Create board
BOARD_RESP=$(curl -s -X POST $BASE/api/boards -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"FT Board $TS\",\"description\":\"Testing all features\",\"boardType\":\"DEFAULT\",\"maxAgents\":5}")
BOARD_ID=$(echo "$BOARD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create board" "$BOARD_RESP" '"id"'

# Create task on board
TASK_RESP=$(curl -s -X POST $BASE/api/tasks -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Task Alpha $TS\",\"description\":\"Testing new features\",\"boardId\":\"$BOARD_ID\",\"priority\":\"MEDIUM\"}")
TASK_ID=$(echo "$TASK_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create task on board" "$TASK_RESP" '"id"'

# ============ 1. TAGS ============
echo -e "\n${YELLOW}=== 1. TAGS ===${NC}"
TAG_RESP=$(curl -s -X POST $BASE/api/tags -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Bug$TS\",\"color\":\"#ef4444\",\"description\":\"Bug reports\"}")
TAG_ID=$(echo "$TAG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create tag" "$TAG_RESP" '"slug"'

TAG2_RESP=$(curl -s -X POST $BASE/api/tags -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Enh$TS\",\"color\":\"#3b82f6\"}")
TAG2_ID=$(echo "$TAG2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create second tag" "$TAG2_RESP" '"slug"'

TAGS_LIST=$(curl -s $BASE/api/tags -H "$AUTH")
check "List tags" "$TAGS_LIST" "Bug$TS"

TAG_UPD=$(curl -s -X PATCH $BASE/api/tags/$TAG_ID -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"color":"#dc2626"}')
check "Update tag color" "$TAG_UPD" '#dc2626'

ASSIGN_RESP=$(curl -s -X POST $BASE/api/tags/assign -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"taskId\":\"$TASK_ID\",\"tagIds\":[\"$TAG_ID\",\"$TAG2_ID\"]}")
check "Assign tags to task" "$ASSIGN_RESP" 'tagId'

DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/tags/$TAG2_ID -H "$AUTH")
check_status "Delete tag" "$DEL_STATUS" "204"

# ============ 2. TASK FINGERPRINTS ============
echo -e "\n${YELLOW}=== 2. TASK FINGERPRINTS ===${NC}"
TASK_CHECK=$(curl -s $BASE/api/tasks -H "$AUTH" | python3 -c "
import sys,json
tasks = json.load(sys.stdin)
for t in tasks:
    if t['id'] == '$TASK_ID':
        fp = t.get('fingerprintHash', '')
        print(fp if fp else 'NONE')
" 2>/dev/null)
check "Task has fingerprint hash" "FP:$TASK_CHECK" "FP:[a-f0-9]"

DUP_RESP=$(curl -s -X POST $BASE/api/tasks -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Task Alpha $TS\",\"description\":\"Testing new features\",\"boardId\":\"$BOARD_ID\",\"priority\":\"LOW\"}")
check "Create duplicate task (returns id)" "$DUP_RESP" '"id"'
DUP_CHECK=$(echo "$DUP_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('HAS_DUPLICATE' if d.get('duplicateOf') else 'NO_DUPLICATE')" 2>/dev/null)
check "Duplicate detected" "$DUP_CHECK" "HAS_DUPLICATE"

# ============ 3. CUSTOM FIELDS ============
echo -e "\n${YELLOW}=== 3. CUSTOM FIELDS ===${NC}"
CF_RESP=$(curl -s -X POST $BASE/api/custom-fields -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"fieldKey\":\"pscore_$TS\",\"label\":\"Priority Score $TS\",\"fieldType\":\"INTEGER\",\"uiVisibility\":\"ALWAYS\"}")
CF_ID=$(echo "$CF_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create custom field definition" "$CF_RESP" "pscore_$TS"

CF2_RESP=$(curl -s -X POST $BASE/api/custom-fields -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"fieldKey\":\"dnote_$TS\",\"label\":\"Due Note $TS\",\"fieldType\":\"TEXT\",\"uiVisibility\":\"IF_SET\",\"defaultValue\":\"TBD\"}")
CF2_ID=$(echo "$CF2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create second custom field" "$CF2_RESP" "dnote_$TS"

CF_LIST=$(curl -s $BASE/api/custom-fields -H "$AUTH")
check "List custom field definitions" "$CF_LIST" "Priority Score $TS"

ATTACH_RESP=$(curl -s -X POST $BASE/api/custom-fields/$CF_ID/attach -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"boardIds\":[\"$BOARD_ID\"]}")
check "Attach field to board" "$ATTACH_RESP" 'boardId'

BF_RESP=$(curl -s "$BASE/api/custom-fields/boards/$BOARD_ID" -H "$AUTH")
check "Get board custom fields" "$BF_RESP" "pscore_$TS"

SV_RESP=$(curl -s -X POST $BASE/api/custom-fields/values -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"taskId\":\"$TASK_ID\",\"definitionId\":\"$CF_ID\",\"value\":\"85\"}")
check "Set custom field value" "$SV_RESP" '"85"'

TV_RESP=$(curl -s "$BASE/api/custom-fields/values/$TASK_ID" -H "$AUTH")
check "Get task custom field values" "$TV_RESP" '"85"'

DEL_CF=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/custom-fields/$CF2_ID -H "$AUTH")
check_status "Delete custom field" "$DEL_CF" "204"

# ============ 4. SOUL TEMPLATES ============
echo -e "\n${YELLOW}=== 4. SOUL TEMPLATES ===${NC}"
ST_RESP=$(curl -s -X POST $BASE/api/soul-templates -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Code Reviewer $TS\",\"category\":\"coding\",\"description\":\"Reviews code for quality\",\"content\":\"# Code Reviewer\\nYou are a code reviewer.\"}")
ST_ID=$(echo "$ST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create soul template" "$ST_RESP" '"slug"'

ST2_RESP=$(curl -s -X POST $BASE/api/soul-templates -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Research Agent $TS\",\"category\":\"research\",\"description\":\"Researches topics\",\"content\":\"# Research Agent\\nYou research topics thoroughly.\"}")
ST2_ID=$(echo "$ST2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create second template" "$ST2_RESP" "Research Agent $TS"

ST_LIST=$(curl -s $BASE/api/soul-templates -H "$AUTH")
check "List soul templates" "$ST_LIST" "Code Reviewer $TS"

ST_SEARCH=$(curl -s "$BASE/api/soul-templates/search?q=code" -H "$AUTH")
check "Search soul templates" "$ST_SEARCH" "Code Reviewer $TS"

ST_GET=$(curl -s "$BASE/api/soul-templates/$ST_ID" -H "$AUTH")
check "Get soul template by ID" "$ST_GET" '"content"'

ST_UPD=$(curl -s -X PATCH $BASE/api/soul-templates/$ST_ID -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"description":"Expert code reviewer"}')
check "Update soul template" "$ST_UPD" '"Expert code reviewer"'

DEL_ST=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/soul-templates/$ST2_ID -H "$AUTH")
check_status "Delete soul template" "$DEL_ST" "204"

# ============ 5. SKILLS MARKETPLACE ============
echo -e "\n${YELLOW}=== 5. SKILLS MARKETPLACE ===${NC}"
SK_RESP=$(curl -s -X POST $BASE/api/skills/marketplace -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Web Scraper $TS\",\"description\":\"Scrapes web pages\",\"category\":\"data\",\"risk\":\"medium\"}")
SK_ID=$(echo "$SK_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create marketplace skill" "$SK_RESP" "Web Scraper $TS"

SK2_RESP=$(curl -s -X POST $BASE/api/skills/marketplace -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"File Manager $TS\",\"description\":\"Manages files\",\"category\":\"general\",\"risk\":\"low\"}")
check "Create second skill" "$SK2_RESP" "File Manager $TS"

SK_LIST=$(curl -s $BASE/api/skills/marketplace -H "$AUTH")
check "List marketplace skills" "$SK_LIST" "Web Scraper $TS"

if [ -n "$GATEWAY_ID" ]; then
  INST_RESP=$(curl -s -X POST $BASE/api/skills/marketplace/$SK_ID/install -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"gatewayId\":\"$GATEWAY_ID\"}")
  check "Install skill on gateway" "$INST_RESP" 'gatewayId'

  UNINST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/api/skills/marketplace/$SK_ID/uninstall -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{\"gatewayId\":\"$GATEWAY_ID\"}")
  check_status "Uninstall skill from gateway" "$UNINST_STATUS" "204"
fi

PKG_RESP=$(curl -s -X POST $BASE/api/skills/packs -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Starter Pack $TS\",\"description\":\"Basic skills\",\"sourceUrl\":\"https://github.com/example/skills-$TS\",\"branch\":\"main\"}")
check "Create skill pack" "$PKG_RESP" "Starter Pack $TS"

PKG_LIST=$(curl -s $BASE/api/skills/packs -H "$AUTH")
check "List skill packs" "$PKG_LIST" "Starter Pack $TS"

# ============ 6. BOARD WEBHOOKS ============
echo -e "\n${YELLOW}=== 6. BOARD WEBHOOKS ===${NC}"
WH_RESP=$(curl -s -X POST $BASE/api/boards/$BOARD_ID/webhooks -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"description":"CI/CD notifications"}')
WH_ID=$(echo "$WH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
WH_SECRET=$(echo "$WH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))" 2>/dev/null)
check "Create webhook" "$WH_RESP" '"secret"'

WH_LIST=$(curl -s $BASE/api/boards/$BOARD_ID/webhooks -H "$AUTH")
check "List webhooks" "$WH_LIST" '"CI/CD notifications"'

INBOUND_RESP=$(curl -s -X POST "$BASE/api/v1/webhooks/$BOARD_ID/$WH_ID" \
  -H 'Content-Type: application/json' \
  -H "X-Webhook-Secret: $WH_SECRET" \
  -d '{"event":"build.completed","status":"success","commit":"abc123"}')
check "Inbound webhook payload" "$INBOUND_RESP" 'received|id|payload'

PL_LIST=$(curl -s "$BASE/api/boards/$BOARD_ID/webhooks/$WH_ID/payloads" -H "$AUTH")
check "List webhook payloads" "$PL_LIST" 'build.completed|payload'

WH_UPD=$(curl -s -X PATCH "$BASE/api/boards/$BOARD_ID/webhooks/$WH_ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"description":"Updated CI/CD webhook","enabled":true}')
check "Update webhook" "$WH_UPD" '"Updated CI/CD webhook"'

BAD_INBOUND=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/webhooks/$BOARD_ID/$WH_ID" \
  -H 'Content-Type: application/json' \
  -H "X-Webhook-Secret: wrong-secret" \
  -d '{"event":"should.fail"}')
check_status "Reject invalid webhook secret" "$BAD_INBOUND" "401"

# ============ 7. BOARD ONBOARDING ============
echo -e "\n${YELLOW}=== 7. BOARD ONBOARDING ===${NC}"
OB_START=$(curl -s -X POST "$BASE/api/boards/$BOARD_ID/onboarding/start" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"sessionKey":"test-session-1"}')
OB_ID=$(echo "$OB_START" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Start onboarding session" "$OB_START" '"status"'

OB_MSG=$(curl -s -X POST "$BASE/api/boards/$BOARD_ID/onboarding/message" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$OB_ID\",\"message\":\"We want to track customer support tickets\"}")
check "Send onboarding message" "$OB_MSG" 'messages'

OB_GET=$(curl -s "$BASE/api/boards/$BOARD_ID/onboarding" -H "$AUTH")
check "Get onboarding session" "$OB_GET" 'messages'

OB_CONFIRM=$(curl -s -X POST "$BASE/api/boards/$BOARD_ID/onboarding/confirm" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$OB_ID\"}")
check "Confirm onboarding" "$OB_CONFIRM" 'COMPLETED|completed|status'

# ============ 8. BOARD GROUP MEMORY ============
echo -e "\n${YELLOW}=== 8. BOARD GROUP MEMORY ===${NC}"
BG_RESP=$(curl -s -X POST $BASE/api/boards/groups -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test Group $TS\",\"description\":\"For testing group memory\"}")
BG_ID=$(echo "$BG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create board group" "$BG_RESP" "Test Group $TS"

if [ -n "$BG_ID" ] && [ "$BG_ID" != "" ] && [ "$BG_ID" != "None" ]; then
  MEM_RESP=$(curl -s -X POST "$BASE/api/board-groups/$BG_ID/memory" -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"content":"Always prioritize security fixes over feature work","tags":["policy","priority"],"source":"manual"}')
  MEM_ID=$(echo "$MEM_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  check "Add group memory" "$MEM_RESP" '"content"'

  MEM2_RESP=$(curl -s -X POST "$BASE/api/board-groups/$BG_ID/memory" -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"content":"Use conventional commits for all messages","tags":["convention"],"isChat":true}')
  check "Add second memory" "$MEM2_RESP" '"content"'

  MEM_LIST=$(curl -s "$BASE/api/board-groups/$BG_ID/memory" -H "$AUTH")
  check "List group memory" "$MEM_LIST" 'prioritize|conventional'

  if [ -n "$MEM_ID" ] && [ "$MEM_ID" != "None" ]; then
    DEL_MEM=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/board-groups/$BG_ID/memory/$MEM_ID" -H "$AUTH")
    check_status "Delete group memory" "$DEL_MEM" "204"
  fi
else
  echo -e "  ${RED}FAIL${NC} Board group creation failed, skipping memory tests"
  FAIL=$((FAIL + 4))
fi

# ============ 9. AGENT A2A TOGGLE ============
echo -e "\n${YELLOW}=== 9. AGENT A2A TOGGLE ===${NC}"
if [ -n "$AGENT_ID" ]; then
  AGENT_GET=$(curl -s "$BASE/api/agents/$AGENT_ID" -H "$AUTH")
  check "Agent has agentToAgent field" "$AGENT_GET" '"agentToAgent"'

  A2A_ON=$(curl -s -X PATCH "$BASE/api/agents/$AGENT_ID/a2a" -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"enabled":true}')
  check "Enable A2A" "$A2A_ON" '"agentToAgent":true'

  A2A_OFF=$(curl -s -X PATCH "$BASE/api/agents/$AGENT_ID/a2a" -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"enabled":false}')
  check "Disable A2A" "$A2A_OFF" '"agentToAgent":false'
else
  echo -e "  ${RED}SKIP${NC} No agent found"
  FAIL=$((FAIL + 3))
fi

# ============ 10. INVITATION SYSTEM ============
echo -e "\n${YELLOW}=== 10. INVITATION SYSTEM ===${NC}"
INV_RESP=$(curl -s -X POST $BASE/api/org/invites -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"invitedEmail\":\"user$TS@example.com\",\"role\":\"MEMBER\"}")
INV_ID=$(echo "$INV_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create invitation" "$INV_RESP" "user$TS@example.com"

INV2_RESP=$(curl -s -X POST $BASE/api/org/invites -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"invitedEmail\":\"view$TS@example.com\",\"role\":\"VIEWER\"}")
INV2_ID=$(echo "$INV2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
check "Create second invitation" "$INV2_RESP" "view$TS@example.com"

INV_LIST=$(curl -s $BASE/api/org/invites -H "$AUTH")
check "List invitations" "$INV_LIST" "user$TS@example.com"

DEL_INV=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE/api/org/invites/$INV2_ID -H "$AUTH")
check_status "Revoke invitation" "$DEL_INV" "204"

# ============ 11. BOARD POLICIES ============
echo -e "\n${YELLOW}=== 11. BOARD POLICIES ===${NC}"
POL_RESP=$(curl -s -X PATCH "$BASE/api/boards/$BOARD_ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"requireReviewBeforeDone":true}')
check "Enable requireReviewBeforeDone" "$POL_RESP" '"requireReviewBeforeDone":true'

BLOCK_RESP=$(curl -s -X PATCH "$BASE/api/tasks/$TASK_ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"status":"DONE"}')
check "Policy blocks DONE without review" "$BLOCK_RESP" 'error|review|approved|approval'

POL2_RESP=$(curl -s -X PATCH "$BASE/api/boards/$BOARD_ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"onlyLeadCanChangeStatus":true}')
check "Enable onlyLeadCanChangeStatus" "$POL2_RESP" '"onlyLeadCanChangeStatus":true'

# Reset policies
curl -s -X PATCH "$BASE/api/boards/$BOARD_ID" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"requireReviewBeforeDone":false,"onlyLeadCanChangeStatus":false}' > /dev/null

# ============ SUMMARY ============
echo -e "\n${YELLOW}============================================${NC}"
echo -e "${YELLOW}  TEST RESULTS: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo -e "${YELLOW}============================================${NC}"
if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}Failed tests:${NC}$ERRORS"
  exit 1
else
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit 0
fi
