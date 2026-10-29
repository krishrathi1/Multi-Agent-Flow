export type AgentStatus = 'ONLINE' | 'IDLE' | 'OFFLINE' | 'ERROR';
export type ActivityType = 'HEARTBEAT' | 'TASK_START' | 'TASK_COMPLETE' | 'ERROR' | 'MESSAGE' | 'DELEGATION' | 'ALERT' | 'SYSTEM';
export type TaskStatus = 'BACKLOG' | 'ASSIGNED' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Agent {
  id: string;
  name: string;
  displayName: string;
  workspace: string;
  description: string;
  status: AgentStatus;
  lastHeartbeat: string | null;
  heartbeatInterval: number;
  currentTask: string | null;
  avatar: string | null;
  enabled: boolean;
  soulMd: string | null;
  gatewayId: string | null;
  gatewayAgentId: string | null;
  boardId: string | null;
  isBoardLead: boolean;
  agentToAgent: boolean;
  soulTemplateId: string | null;
  processId: string | null;
  processRole: string | null;
  processStage: number;
  createdAt: string;
  updatedAt: string;
  _count?: { activities: number; tasks: number };
  activities?: Activity[];
  tasks?: Task[];
  agentSkills?: AgentSkill[];
  integrations?: AgentIntegration[];
  gateway?: Gateway;
}

export interface Activity {
  id: string;
  agentId: string;
  type: ActivityType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  agent: {
    name: string;
    displayName: string;
    avatar: string | null;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  agentId: string | null;
  boardId?: string | null;
  createdAt: string;
  updatedAt: string;
  agent: {
    id: string;
    name: string;
    displayName: string;
    avatar: string | null;
  } | null;
  fingerprintHash?: string | null;
  tags?: TagAssignment[];
  customFieldValues?: TaskCustomFieldValue[];
  duplicateOf?: { id: string; title: string; status: TaskStatus } | null;
}

export interface AgentStats {
  total: number;
  online: number;
  idle: number;
  offline: number;
  error: number;
  recentActivities: number;
  activeTasks: number;
}

// Inter-agent communication
export interface Thread {
  id: string;
  title: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  receiverId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  sender: { id: string; name: string; displayName: string; avatar: string | null };
  receiver: { id: string; name: string; displayName: string; avatar: string | null };
}

// Sessions & Timeline
export interface Session {
  id: string;
  agentId: string;
  type: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  status: string;
  summary: string | null;
  tokensUsed: number | null;
  cost: number | null;
  agent?: { id: string; name: string; displayName: string; avatar: string | null };
}

// Cost & Tokens
export interface TokenUsage {
  id: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  cost: number;
  createdAt: string;
  agent?: { name?: string; displayName?: string; avatar?: string | null };
}

// Performance Metrics
export interface MetricSnapshot {
  id: string;
  agentId: string;
  responseTimeMs: number;
  success: boolean;
  errorMessage: string | null;
  toolName: string | null;
  createdAt: string;
}

// Alerts
export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  agentId: string | null;
  condition: string;
  threshold: number | null;
  windowMinutes: number;
  enabled: boolean;
  lastTriggered: string | null;
  createdAt: string;
  agent?: { id: string; name: string; displayName: string; avatar: string | null } | null;
  events?: AlertEvent[];
  _count?: { events: number };
}

export interface AlertEvent {
  id: string;
  alertRuleId: string;
  message: string;
  severity: Severity;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  alertRule?: AlertRule;
}

// Human-in-the-loop commands
export interface Command {
  id: string;
  agentId: string;
  type: string;
  payload: Record<string, unknown> | null;
  status: string;
  issuedBy: string | null;
  createdAt: string;
  agent?: { id: string; name: string; displayName: string; avatar: string | null };
}

// Communication graph edge
export interface CommEdge {
  source: string;
  target: string;
  messageCount: number;
  lastMessage: string;
}

// Organization & Auth
export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings?: Record<string, unknown>;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  user: { id: string; email: string; name: string };
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
}

export interface OrgApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// MCP Servers & Tools
export interface McpServer {
  id: string;
  agentId: string;
  name: string;
  url: string;
  transport: 'SSE' | 'STREAMABLE_HTTP';
  enabled: boolean;
  lastConnected: string | null;
  tools?: McpTool[];
  createdAt: string;
}

export interface McpTool {
  id: string;
  mcpServerId: string;
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  createdAt: string;
}

// Gateways
export type GatewayStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Gateway {
  id: string;
  name: string;
  url: string;
  workspaceRoot: string;
  status: GatewayStatus;
  hasToken: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { agents: number };
}

export interface GatewayHealth {
  status: string;
  connected: boolean;
  /** Gateway build, when the probe reports it. */
  version?: string;
  /** Seconds since the gateway started. */
  uptime?: number;
  details?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

// Chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatHistory {
  sessionKey: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  status: string;
  result?: string;
  summary?: string;
  model?: string;
}

// Workspace Files
export interface WorkspaceFile {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

// LLM Providers
export type LlmProviderMode = 'BYOK' | 'PLATFORM';

export interface LlmProvider {
  id: string;
  provider: string;
  mode: LlmProviderMode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCredit {
  id: string;
  balanceCents: number;
  totalSpentCents: number;
  lastTopUpAt: string | null;
}

// Boards
export interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  gatewayId: string | null;
  boardGroupId: string | null;
  boardType: string;
  objective: string | null;
  successMetrics: Record<string, unknown> | null;
  targetDate: string | null;
  maxAgents: number;
  requireApprovalForDone: boolean;
  requireReviewBeforeDone: boolean;
  blockStatusChangesWithPendingApproval: boolean;
  onlyLeadCanChangeStatus: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number; agents: number; approvals: number };
  tasks?: Task[];
  agents?: Agent[];
}

export interface BoardGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  _count?: { boards: number };
  boards?: Board[];
}

// Approvals
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Approval {
  id: string;
  boardId: string;
  taskId: string | null;
  agentId: string | null;
  actionType: string;
  payload: Record<string, unknown> | null;
  confidence: number | null;
  status: ApprovalStatus;
  resolvedAt: string | null;
  createdAt: string;
  board?: Board;
  task?: Task | null;
  agent?: Agent | null;
}

// Board Memory
export interface BoardMemory {
  id: string;
  boardId: string;
  content: string;
  tags: string[] | null;
  isChat: boolean;
  source: string | null;
  createdAt: string;
}

// ─── Tags ────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { assignments: number };
}

export interface TagAssignment {
  id: string;
  taskId: string;
  tagId: string;
  tag: Tag;
  createdAt: string;
}

// ─── Task Fingerprints ──────────────────────────────

export interface TaskFingerprint {
  id: string;
  boardId: string;
  fingerprintHash: string;
  taskId: string;
  createdAt: string;
}

// ─── Custom Fields ──────────────────────────────────

export type CustomFieldType = 'TEXT' | 'TEXT_LONG' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATE_TIME' | 'URL' | 'JSON';
export type CustomFieldVisibility = 'ALWAYS' | 'IF_SET' | 'HIDDEN';

export interface TaskCustomFieldDefinition {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  uiVisibility: CustomFieldVisibility;
  validationRegex: string | null;
  defaultValue: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { boardFields: number; values: number };
}

export interface BoardTaskCustomField {
  id: string;
  boardId: string;
  definitionId: string;
  definition: TaskCustomFieldDefinition;
  createdAt: string;
}

export interface TaskCustomFieldValue {
  id: string;
  taskId: string;
  definitionId: string;
  definition: TaskCustomFieldDefinition;
  value: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Skills Marketplace ─────────────────────────────

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  risk: string;
  sourceUrl: string | null;
  metadata: Record<string, unknown> | null;
  installedGatewayIds: string[];
  isInstalled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  branch: string;
  metadata: Record<string, unknown> | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayInstalledSkill {
  id: string;
  gatewayId: string;
  skillId: string;
  createdAt: string;
}

export interface AgentSkill {
  id: string;
  agentId: string;
  skillId: string;
  customName: string | null;
  customDescription: string | null;
  customConfig: Record<string, unknown> | null;
  enabled: boolean;
  skill: MarketplaceSkill;
  createdAt: string;
  updatedAt: string;
}

// ─── Agent Integrations ─────────────────────────────

export type ChannelType = 'TELEGRAM' | 'SLACK' | 'GOOGLE_CHAT';

export interface AgentIntegration {
  id: string;
  agentId: string;
  channel: ChannelType;
  enabled: boolean;
  botToken: string | null;
  appToken: string | null;
  serviceAccount: Record<string, unknown> | null;
  webhookUrl: string | null;
  dmPolicy: string;
  groupPolicy: string;
  status: string;
  lastError: string | null;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Board Webhooks ─────────────────────────────────

export interface BoardWebhook {
  id: string;
  boardId: string;
  agentId: string | null;
  description: string;
  secret: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  agent?: { id: string; displayName: string; avatar: string | null } | null;
  _count?: { payloads: number };
}

export interface BoardWebhookPayload {
  id: string;
  webhookId: string;
  payload: unknown;
  headers: Record<string, string> | null;
  sourceIp: string | null;
  contentType: string | null;
  receivedAt: string;
}

// ─── Board Onboarding ───────────────────────────────

export type OnboardingStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface BoardOnboardingSession {
  id: string;
  boardId: string;
  sessionKey: string;
  status: OnboardingStatus;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  draftGoal: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Board Group Memory ─────────────────────────────

export interface BoardGroupMemory {
  id: string;
  boardGroupId: string;
  content: string;
  tags: string[] | null;
  isChat: boolean;
  source: string | null;
  createdAt: string;
}

// ─── Organization Invites ───────────────────────────

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface OrgInvite {
  id: string;
  organizationId: string;
  invitedEmail: string;
  token: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: InviteStatus;
  allBoardsRead: boolean;
  allBoardsWrite: boolean;
  createdByUserId: string | null;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  boardAccess?: OrgInviteBoardAccess[];
}

export interface OrgInviteBoardAccess {
  id: string;
  inviteId: string;
  boardId: string;
  canRead: boolean;
  canWrite: boolean;
}

// ─── Soul Templates ─────────────────────────────────

export interface SoulTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}


// ── Production chains ────────────────────────────────────────────────

export type ProcessStatus =
  | 'DRAFT'
  | 'PLANNING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED';

export interface PlannedAgent {
  name: string;
  displayName: string;
  role: string;
  description: string;
  stage: number;
  soulMd: string;
  soulTemplateId?: string | null;
  soulTemplateName?: string | null;
  heartbeatInterval: number;
  avatar: string | null;
}

export interface ProcessStage {
  stage: number;
  label: string;
  name?: string;
  description?: string;
}

/** Planner output, before anything is persisted. */
export interface ProcessPlan {
  name: string;
  summary: string;
  agents: PlannedAgent[];
  stages: ProcessStage[];
  /** "heuristic" or "llm:<model>" — surfaced so users know what produced it. */
  plannedBy: string;
}

export interface Process {
  id: string;
  organizationId: string;
  name: string;
  prompt: string;
  summary: string | null;
  status: ProcessStatus;
  plan: ProcessPlan | null;
  plannedBy: string | null;
  agentCount: number;
  color: string | null;
  icon: string | null;
  budgetUsd?: number | null;
  maxTokens?: number | null;
  approvalMode?: ApprovalMode;
  /** How agents share context: a shared blackboard, or direct stage-to-stage messages. */
  messagingMode?: MessagingMode;
  /** Who may open the chain's generated artifacts. */
  previewVisibility?: PreviewVisibility;
  /** Operator guidance injected into the next run. */
  guidance?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agents?: Agent[];
  tasks?: Task[];
  taskCount?: number;
  activityCount?: number;
  onlineAgents?: number;
  erroredAgents?: number;
}

export interface ProcessStats {
  total: number;
  active: number;
  agentsInProcesses: number;
}


export interface WorkspaceArtifact {
  path: string;
  size: number;
  modifiedAt: string;
}

export interface RunStepResult {
  agentId: string;
  agentName: string;
  stage: number;
  ok: boolean;
  summary: string;
  durationMs: number;
  tokens: number;
  costUsd: number;
}

export interface ChainRunResult {
  processId: string;
  steps: RunStepResult[];
  files: WorkspaceArtifact[];
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}


export type RunState = 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunStatus {
  processId: string;
  state: RunState;
  startedAt: string;
  finishedAt?: string;
  steps: RunStepResult[];
  currentStage?: number;
  totalStages?: number;
  error?: string;
  result?: ChainRunResult;
}


// ── Orchestration: runs, templates, schedules, webhooks ──────────────

export type PersistedRunState =
  | 'QUEUED'
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
export type RunTrigger = 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'RETRY';

export interface ProcessRunStep {
  id: string;
  agentId: string;
  agentName: string;
  stage: number;
  state: PersistedRunState;
  summary: string | null;
  error: string | null;
  durationMs: number;
  tokens: number;
  costUsd: number;
  files: string[] | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ProcessRun {
  id: string;
  processId: string;
  state: PersistedRunState;
  trigger: RunTrigger;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalTokens: number;
  totalCostUsd: number;
  error: string | null;
  currentStage: number | null;
  totalStages: number | null;
  /** Stage the run is blocked on, when AWAITING_APPROVAL. */
  awaitingStage?: number | null;
  process?: { id: string; name: string; color: string | null };
  steps?: ProcessRunStep[];
  _count?: { steps: number };
}

export interface RunStats {
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  totalTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
}

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  prompt: string;
  plan: ProcessPlan;
  agentCount: number;
  usageCount: number;
  createdAt: string;
}

export interface ProcessSchedule {
  id: string;
  processId: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  process?: { id: string; name: string; color: string | null };
}

export interface ProcessWebhookConfig {
  id: string;
  processId: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  lastFiredAt: string | null;
  lastStatus: number | null;
  createdAt: string;
}


/** Why a webhook delivery ended the way it did. */
export type DeliveryOutcome =
  | 'DELIVERED'
  | 'REJECTED'
  | 'FAILED'
  | 'BLOCKED'
  | 'REDIRECTED';

/**
 * One attempt to deliver a webhook. Delivery used to record only the last
 * status, so a webhook failing quietly for a week looked the same as one that
 * had never fired.
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  outcome: DeliveryOutcome;
  status: number | null;
  error: string | null;
  attempt: number;
  durationMs: number;
  createdAt: string;
  webhook?: { id: string; url: string; processId: string };
}

export type ApprovalMode = 'NONE' | 'EVERY_STAGE' | 'FINAL_STAGE';

export type MessagingMode = 'BLACKBOARD' | 'PEER_TO_PEER';
export type BlackboardKind = 'decision' | 'contract' | 'artifact' | 'issue' | 'question' | 'answer' | 'note';

/** One entry on a production's shared blackboard. */
export interface BlackboardEntry {
  id: string;
  runId: string | null;
  kind: BlackboardKind;
  topic: string;
  content: string;
  author: string;
  authorAgentId: string | null;
  stage: number | null;
  to: string | null;
  status: 'open' | 'resolved' | 'info';
  resolvedBy: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** What a run shared, for comparing blackboard and peer-to-peer runs. */
export interface MessagingStats {
  mode: MessagingMode;
  contextChars: number[];
  entriesPosted: number;
  issuesRaised: number;
  issuesResolved: number;
  reworkSteps: number;
  deliveries: number;
}

export interface BlackboardView {
  mode: MessagingMode;
  entries: BlackboardEntry[];
  runs: Array<{
    id: string;
    state: string;
    startedAt: string;
    durationMs: number | null;
    totalTokens: number;
    totalCostUsd: number;
    messagingMode: MessagingMode | null;
    messaging: MessagingStats | null;
    _count: { steps: number };
  }>;
}

/** One call to a built-in MCP tool server, by an agent, Mother Chat or an operator. */
export interface ToolCall {
  id: string;
  processId: string;
  runId: string | null;
  server: string;
  tool: string;
  caller: string;
  input: Record<string, unknown>;
  output: string;
  ok: boolean;
  durationMs: number;
  createdAt: string;
}

export interface McpToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: { type: 'object'; properties?: Record<string, { type?: string; description?: string; enum?: string[]; items?: { type?: string } }>; required?: string[] };
}

export interface ToolsView {
  enabled: boolean;
  servers: Array<{ server: string; tools: McpToolInfo[] }>;
  calls: ToolCall[];
}

/** Structured output, validated by the Pydantic models in backend/structured/. */
export type OutputStatus = 'completed' | 'partial' | 'blocked' | 'failed';

export interface StageOutput {
  agent: string;
  role: string | null;
  stage: number;
  status: OutputStatus;
  summary: string;
  deliverables: Array<{ path: string; description: string }>;
  decisions: string[];
  issues: Array<{ severity: 'critical' | 'major' | 'minor' | 'info'; description: string; resolved: boolean }>;
  tests: { ran: boolean; passed: boolean | null; command: string | null; details: string | null } | null;
  tools_used: string[];
  next_steps: string[];
  verdict: 'approved' | 'changes_requested' | null;
  source: 'agent' | 'derived';
}

export interface FinalOutputData {
  schema_version: string;
  production: string;
  goal: string;
  run_id: string;
  status: OutputStatus;
  messaging_mode: MessagingMode;
  generated_at: string;
  stages: StageOutput[];
  deliverables: Array<{ path: string; description: string }>;
  open_issues: StageOutput['issues'];
  qa_verdict: 'approved' | 'changes_requested' | null;
  metrics: { duration_seconds: number | null; tokens: number; cost_usd: number; agent_steps: number; tool_calls: number; blackboard_entries: number };
  preview_url: string | null;
}

export interface FinalOutputView {
  runId: string;
  state: string;
  startedAt: string;
  data: FinalOutputData | null;
  markdown: string | null;
  errors: Array<{ loc: string; msg: string; type: string }> | null;
  validatedBy: string;
  generatedAt: string;
}

/** A human gate blocking a chain between stages. */
export interface ChainGate {
  id: string;
  processId: string;
  runId: string;
  stage: number;
  title: string;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
  process?: { id: string; name: string; color: string | null };
}


export type NotificationKind =
  | 'GATE_PENDING'
  | 'RUN_FAILED'
  | 'RUN_COMPLETED'
  | 'BUDGET_STOPPED'
  | 'SCHEDULE_FIRED';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  processId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CostEstimate {
  basis: 'history' | 'similar' | 'none';
  runsSampled: number;
  estimatedCostUsd: number;
  expectedCostUsd?: number;
  estimatedTokens: number;
  estimatedMs: number;
  minCostUsd: number;
  maxCostUsd: number;
}

export interface AgentInsight {
  agentId: string;
  agentName: string;
  runs: number;
  failures: number;
  successRate: number;
  avgDurationMs: number;
  totalCostUsd: number;
  totalTokens: number;
}

export type PreviewVisibility = 'PUBLIC' | 'TOKEN' | 'PRIVATE';

/* ---- Run comparison ------------------------------------------------------
   A total that got worse is not actionable; the stage that caused it is.
   ------------------------------------------------------------------------ */

export interface RunSideSummary {
  id: string;
  state: PersistedRunState;
  startedAt: string;
  totalCostUsd: number;
  totalTokens: number;
  durationMs: number;
  steps: number;
}

export interface StageDelta {
  stage: number;
  agentName: string;
  /** Null when the stage exists on only one side — the roster changed. */
  baseCostUsd: number | null;
  headCostUsd: number | null;
  baseDurationMs: number | null;
  headDurationMs: number | null;
  costDelta: number;
  durationDelta: number;
  baseOk: boolean | null;
  headOk: boolean | null;
}

export interface RunComparison {
  base: RunSideSummary;
  head: RunSideSummary;
  costDelta: number;
  tokenDelta: number;
  durationDelta: number;
  /** Null when the baseline was free, so there is no percentage to give. */
  costPct: number | null;
  stages: StageDelta[];
}

/* ---- Chain portability --------------------------------------------------- */

export interface ChainBundleAgent {
  name: string;
  displayName: string;
  role: string;
  description: string;
  stage: number;
  soulMd: string;
  heartbeatInterval: number;
  avatar: string | null;
}

/** A self-contained chain, portable between orgs and environments. */
export interface ChainBundle {
  nexusChainVersion: number;
  name: string;
  prompt: string;
  summary?: string;
  plannedBy?: string;
  guidance?: string | null;
  guardrails?: {
    approvalMode?: ApprovalMode;
    budgetUsd?: number | null;
    maxTokens?: number | null;
  };
  agents: ChainBundleAgent[];
  stages?: Array<{ stage: number; label: string }>;
}
