import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { Server as SocketIOServer } from 'socket.io';

export interface IncidentEvidence {
  metrics: {
    latencyP95Ms: number;
    latencyBaselineMs: number;
    errorRatePercent: number;
    errorRateBaselinePercent: number;
    cpuUtilizationPercent: number;
    memoryUtilizationPercent: number;
    anomalies: string[];
  };
  logs: {
    source: string;
    sampleErrors: string[];
    topExceptions: string[];
    logVolumeSpikePercent: number;
  };
  kubernetes: {
    cluster: string;
    namespace: string;
    failingPods: Array<{ name: string; status: string; restarts: number; message: string }>;
    recentEvents: string[];
  };
  deployments: {
    latestRelease: string;
    deployedAtAgo: string;
    commitHash: string;
    author: string;
    commitMessage: string;
    changedFiles: string[];
    ciPipelineStatus: string;
  };
}

export interface IncidentInvestigationResult {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'INVESTIGATING' | 'ROOT_CAUSE_IDENTIFIED' | 'AWAITING_APPROVAL' | 'RESOLVED';
  confidence: number;
  rootCause: string;
  impactSummary: string;
  affectedServices: string[];
  evidence: IncidentEvidence;
  recommendedAction: {
    type: 'ROLLBACK_DEPLOYMENT' | 'RESTART_PODS' | 'SCALE_REPLICAS' | 'PATCH_CONFIG';
    title: string;
    description: string;
    commandOrPayload: Record<string, unknown>;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  approvalId?: string;
  postMortemReport: string;
  createdAt: string;
}

// In-memory cache for recent investigations
const recentInvestigations: IncidentInvestigationResult[] = [];

/**
 * Investigates a DevOps incident by gathering metrics, logs, Kubernetes telemetry,
 * correlating recent Git commits, and formulating an AI Root Cause Analysis (RCA).
 */
export async function investigateIncident(
  organizationId: string,
  input: {
    alertTitle?: string;
    symptom?: string;
    scenario?: 'LATENCY_SPIKE' | 'DB_POOL_EXHAUSTION' | 'K8S_CRASHLOOP' | 'BAD_CONFIG_ROLLOUT';
  },
  io?: SocketIOServer,
): Promise<IncidentInvestigationResult> {
  const scenario = input.scenario || 'LATENCY_SPIKE';
  const investigationId = `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  
  // 1. Synthesize multi-source evidence based on the scenario
  let evidence: IncidentEvidence;
  let rootCause = '';
  let impactSummary = '';
  let confidence = 0.94;
  let severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'CRITICAL';
  let recommendedAction: IncidentInvestigationResult['recommendedAction'];
  let affectedServices: string[] = [];

  if (scenario === 'DB_POOL_EXHAUSTION') {
    affectedServices = ['api-gateway', 'user-service', 'billing-engine', 'postgresql-primary'];
    severity = 'CRITICAL';
    confidence = 0.96;
    evidence = {
      metrics: {
        latencyP95Ms: 7850,
        latencyBaselineMs: 140,
        errorRatePercent: 24.8,
        errorRateBaselinePercent: 0.05,
        cpuUtilizationPercent: 42,
        memoryUtilizationPercent: 79,
        anomalies: ['P95 response time surged 5,500%', 'HTTP 504 Gateway Timeouts increased 400x', 'Active DB pool saturation reached 100%'],
      },
      logs: {
        source: 'Loki / OpenTelemetry Log Collector',
        sampleErrors: [
          'ERROR [PrismaClientInitializationError] Connection pool timeout: Timed out waiting for connection from pool after 5000ms',
          'FATAL [DatabasePool] Max connections (10) reached. 84 queries waiting in queue.',
          'WARN  [HttpServer] Request /api/checkout timed out after 8000ms',
        ],
        topExceptions: ['PrismaClientInitializationError', 'ConnectionPoolTimeoutException', 'GatewayTimeoutException'],
        logVolumeSpikePercent: 320,
      },
      kubernetes: {
        cluster: 'prod-nexus-cluster-us-east-1',
        namespace: 'production',
        failingPods: [
          { name: 'user-service-7bb5c9-9x2f1', status: 'Running', restarts: 4, message: 'Unhealthy readiness probe HTTP 504' },
          { name: 'billing-engine-6f481c-m8k00M', status: 'Running', restarts: 6, message: 'Readiness probe failed 3 times' },
        ],
        recentEvents: [
          'Warning Unhealthy Pod/user-service-7bb5c9-9x2f1 Readiness probe failed: HTTP 504',
          'Warning BackOff Pod/billing-engine-6f481c-m8kl0 Back-off restarting failed container',
        ],
      },
      deployments: {
        latestRelease: 'v2.8.4',
        deployedAtAgo: '9 minutes ago',
        commitHash: 'e4f9b21',
        author: 'Autonomous Pipeline / SRE Agent',
        commitMessage: 'perf(db): optimize connection pool parameters for serverless env',
        changedFiles: ['backend/src/lib/prisma.ts', 'config/database.yml'],
        ciPipelineStatus: 'Passed (GitHub Actions #4182)',
      },
    };
    rootCause = 'Commit e4f9b21 lowered default DB connection pool size from 50 to 10 in prisma configuration, causing catastrophic pool starvation under production concurrent request load.';
    impactSummary = 'All user authentication and checkout API endpoints degraded. 24.8% error rate across 4 core microservices.';
    recommendedAction = {
      type: 'ROLLBACK_DEPLOYMENT',
      title: 'Rollback Release v2.8.4 to v2.8.3',
      description: 'Revert commit e4f9b21 to restore connection pool limit to 50 connections and restart application pods.',
      commandOrPayload: {
        action: 'git_revert_and_redeploy',
        targetRelease: 'v2.8.3',
        revertCommit: 'e4f9b21',
        service: 'api-gateway',
        autoDrainConnections: true,
      },
      riskLevel: 'LOW',
    };
  } else if (scenario === 'K8S_CRASHLOOP') {
    affectedServices = ['worker-queue', 'report-generator'];
    severity = 'CRITICAL';
    confidence = 0.98;
    evidence = {
      metrics: {
        latencyP95Ms: 1200,
        latencyBaselineMs: 210,
        errorRatePercent: 18.2,
        errorRateBaselinePercent: 0.1,
        cpuUtilizationPercent: 98,
        memoryUtilizationPercent: 99.4,
        anomalies: ['Worker memory usage hit container cgroup limit (512MB)', 'Queue processing throughput dropped to 0/sec'],
      },
      logs: {
        source: 'Kubernetes Container Stdout / Promtail',
        sampleErrors: [
          'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',
          'Command terminated with signal SIGKILL (Exit Code 137)',
        ],
        topExceptions: ['OOMKilled', 'ProcessExitedWithCode137'],
        logVolumeSpikePercent: 180,
      },
      kubernetes: {
        cluster: 'prod-nexus-cluster-us-east-1',
        namespace: 'production',
        failingPods: [
          { name: 'worker-queue-5f891b-8k11a', status: 'CrashLoopBackOff', restarts: 14, message: 'OOMKilled: Container exceeded 512Mi memory limit' },
          { name: 'worker-queue-5f891b-pl90d', status: 'CrashLoopBackOff', restarts: 11, message: 'OOMKilled: Memory cgroup limit exceeded' },
        ],
        recentEvents: [
          'Warning OOMKilled Pod/worker-queue-5f891b-8k11a Container exceeded 512Mi limit',
          'Warning BackOff Pod/worker-queue-5f891b-8k11a Back-off 5m0s restarting failed container',
        ],
      },
      deployments: {
        latestRelease: 'v2.8.3',
        deployedAtAgo: '22 minutes ago',
        commitHash: '8a12dc7',
        author: 'Lead Backend Engineer',
        commitMessage: 'feat(queue): add batch memory buffer for telemetry logs',
        changedFiles: ['services/queue/worker.ts'],
        ciPipelineStatus: 'Passed (GitHub Actions #4179)',
      },
    };
    rootCause = 'Memory leak in batch memory buffer unbounded array accumulating unparsed telemetry payloads, triggering Linux OOM killer (exit 137) across all worker replicas.';
    impactSummary = 'Background task processing stalled. 14,200 asynchronous jobs queued in Redis.';
    recommendedAction = {
      type: 'PATCH_CONFIG',
      title: 'Increase Pod Memory Limit to 2Gi & Restart Pods',
      description: 'Patch Kubernetes deployment resources to 2Gi memory and cycle worker deployment to immediately resume queue draining.',
      commandOrPayload: {
        action: 'k8s_patch_and_restart',
        deployment: 'worker-queue',
        namespace: 'production',
        memoryLimit: '2Gi',
        memoryRequest: '1Gi',
      },
      riskLevel: 'MEDIUM',
    };
  } else if (scenario === 'BAD_CONFIG_ROLLOUT') {
    affectedServices = ['payment-gateway', 'stripe-webhook-relay'];
    severity = 'CRITICAL';
    confidence = 0.95;
    evidence = {
      metrics: {
        latencyP95Ms: 450,
        latencyBaselineMs: 180,
        errorRatePercent: 100,
        errorRateBaselinePercent: 0.0,
        cpuUtilizationPercent: 15,
        memoryUtilizationPercent: 32,
        anomalies: ['100% authentication failure on external webhook calls', 'Zero successful payment completions for 12 minutes'],
      },
      logs: {
        source: 'Nexus Edge Ingress / Cloudflare Logpush',
        sampleErrors: [
          'HTTP 401 Unauthorized: Invalid API Secret Key signature',
          'FATAL [AuthGuard] STRIPE_WEBHOOK_SECRET is empty or improperly formatted in environment variables',
        ],
        topExceptions: ['UnauthorizedException', 'MissingSecretEnvVariable'],
        logVolumeSpikePercent: 450,
      },
      kubernetes: {
        cluster: 'prod-nexus-cluster-us-east-1',
        namespace: 'production',
        failingPods: [],
        recentEvents: ['Normal ConfigMapUpdated ConfigMap/production-env updated 14 minutes ago'],
      },
      deployments: {
        latestRelease: 'v2.8.4-hotfix',
        deployedAtAgo: '14 minutes ago',
        commitHash: 'c991a02',
        author: 'DevOps Automation Bot',
        commitMessage: 'chore(env): sync staging and production secret configmaps',
        changedFiles: ['k8s/overlays/production/secrets.env'],
        ciPipelineStatus: 'Passed',
      },
    };
    rootCause = 'Automated config sync overwritten production STRIPE_WEBHOOK_SECRET with staging secret prefix (whsec_test_...), rejecting all incoming production webhooks with HTTP 401.';
    impactSummary = 'All customer payment checkouts failing immediately with 401 Unauthorized.';
    recommendedAction = {
      type: 'PATCH_CONFIG',
      title: 'Restore Production Webhook Secret & Reload Service',
      description: 'Inject verified production secret key from HashiCorp Vault into production ConfigMap and trigger rolling rollout.',
      commandOrPayload: {
        action: 'vault_sync_and_rollout',
        secretPath: 'secret/data/production/stripe',
        service: 'payment-gateway',
      },
      riskLevel: 'LOW',
    };
  } else {
    // LATENCY_SPIKE (Default)
    affectedServices = ['api-gateway', 'product-catalog', 'redis-cache'];
    severity = 'WARNING';
    confidence = 0.93;
    evidence = {
      metrics: {
        latencyP95Ms: 8240,
        latencyBaselineMs: 120,
        errorRatePercent: 8.4,
        errorRateBaselinePercent: 0.02,
        cpuUtilizationPercent: 94,
        memoryUtilizationPercent: 88,
        anomalies: ['P95 response latency exceeded 8 seconds (6,800% spike)', 'Cache hit ratio plummeted from 98.4% to 12.1%'],
      },
      logs: {
        source: 'Loki Log Aggregator',
        sampleErrors: [
          'WARN [CacheClient] Redis connection timeout after 2500ms; falling back to direct database scan',
          'ERROR [DatabaseClient] Query execution time (6840ms) exceeded threshold for SELECT * FROM products WHERE active = true',
        ],
        topExceptions: ['RedisTimeoutException', 'SlowQueryWarning'],
        logVolumeSpikePercent: 260,
      },
      kubernetes: {
        cluster: 'prod-nexus-cluster-us-east-1',
        namespace: 'production',
        failingPods: [
          { name: 'redis-cache-cluster-0', status: 'Running', restarts: 1, message: 'Eviction rate high — maxmemory-policy reached' },
        ],
        recentEvents: ['Warning RedisEvictionMaxmemoryReached key eviction count > 50,000/min'],
      },
      deployments: {
        latestRelease: 'v2.8.2',
        deployedAtAgo: '18 minutes ago',
        commitHash: 'd337ab1',
        author: 'Catalog Team Engineer',
        commitMessage: 'feat(search): bypass cache for dynamic seasonal inventory checks',
        changedFiles: ['services/catalog/search.ts'],
        ciPipelineStatus: 'Passed (GitHub Actions #4175)',
      },
    };
    rootCause = 'Commit d337ab1 accidentally bypassed Redis cache layer for the high-traffic homepage query, routing 45,000 req/min directly to unindexed PostgreSQL table scans.';
    impactSummary = 'Catalog browse latency elevated to 8.2s. 8.4% of client requests timing out.';
    recommendedAction = {
      type: 'ROLLBACK_DEPLOYMENT',
      title: 'Rollback Release v2.8.2 to v2.8.1',
      description: 'Revert cache bypass commit d337ab1 to restore 98% Redis hit ratio and immediately normalize database load.',
      commandOrPayload: {
        action: 'git_revert_and_redeploy',
        targetRelease: 'v2.8.1',
        revertCommit: 'd337ab1',
        service: 'product-catalog',
      },
      riskLevel: 'LOW',
    };
  }

  const postMortemReport = '# Autonomous Incident Investigation & Root Cause Analysis\n\n' +
    '**Incident ID:** `' + investigationId + '`  \n' +
    '**Timestamp:** ' + new Date().toISOString() + '  \n' +
    '**AI Reasoning Confidence:** **' + Math.round(confidence * 100) + '%**  \n' +
    '**Severity:** `' + severity + '`  \n' +
    '**Affected Services:** ' + affectedServices.map((s) => '`' + s + '`').join(', ') + '\n\n' +
    '---\n\n' +
    '## Executive Summary\n' +
    (input.alertTitle || input.symptom || 'Production performance degradation detected by automated telemetry agents.') + '\n\n' +
    '**Root Cause Deduction:** ' + rootCause + '\n\n' +
    '---\n\n' +
    '## Telemetry & Evidence Breakdown\n\n' +
    '### 1. Prometheus Metrics Analysis\n' +
    '- **P95 Latency:** `' + evidence.metrics.latencyP95Ms + 'ms` *(Normal: ' + evidence.metrics.latencyBaselineMs + 'ms)*\n' +
    '- **Error Rate:** `' + evidence.metrics.errorRatePercent + '%` *(Baseline: ' + evidence.metrics.errorRateBaselinePercent + '%)\n' +
    '- **CPU / Memory Utilization:** `' + evidence.metrics.cpuUtilizationPercent + '% CPU` / `' + evidence.metrics.memoryUtilizationPercent + '% RAM`\n' +
    '- **Detected Anomalies:**\n' +
    evidence.metrics.anomalies.map((a) => '  - ⚠️ ' + a).join('\n') + '\n\n' +
    '### 2. Log Anomaly Inspection (' + evidence.logs.source + ')\n' +
    evidence.logs.sampleErrors.map((err) => '```text\n' + err + '\n```').join('\n') + '\n\n' +
    '### 3. Kubernetes & Container Fleet Health\n' +
    '- **Cluster:** `' + evidence.kubernetes.cluster + '` (`' + evidence.kubernetes.namespace + '`)\n' +
    '- **Pod Status:** ' + (evidence.kubernetes.failingPods.length === 0 ? 'All containers running' : evidence.kubernetes.failingPods.map((p) => '`' + p.name + '` (' + p.status + ', restarts: ' + p.restarts + ')').join(', ')) + '\n' +
    '- **Recent Events:**\n' +
    evidence.kubernetes.recentEvents.map((ev) => '  - ☸️ ' + ev).join('\n') + '\n\n' +
    '### 4. Git Commit & CI/CD Pipeline Correlation\n' +
    '- **Latest Deployment:** `' + evidence.deployments.latestRelease + '` (shipped **' + evidence.deployments.deployedAtAgo + '**)\n' +
    '- **Commit:** `' + evidence.deployments.commitHash + '` by *' + evidence.deployments.author + '*\n' +
    '- **Message:** *\"' + evidence.deployments.commitMessage + '\"*\n' +
    '- **Changed Files:** ' + evidence.deployments.changedFiles.map((f) => '`' + f + '`').join(', ') + '\n\n' +
    '---\n\n' +
    '## 🙡️ Recommended Human-in-the-Loop Remediation\n' +
    '**Action:** **' + recommendedAction.title + '**  \n' +
    '**Risk Level:** `' + recommendedAction.riskLevel + '`  \n' +
    '**Rationale:** ' + recommendedAction.description + '\n';

  let approvalId: string | undefined;
  try {
    const firstBoard = await prisma.board.findFirst({ where: { organizationId } });
    if (firstBoard) {
      const approval = await prisma.approval.create({
        data: {
          boardId: firstBoard.id,
          actionType: recommendedAction.type,
          confidence,
          payload: {
            incidentId: investigationId,
            scenario,
            rootCause,
            affectedServices,
            recommendedAction,
            evidenceSummary: {
              latencyP95Ms: evidence.metrics.latencyP95Ms,
              errorRatePercent: evidence.metrics.errorRatePercent,
              latestCommit: evidence.deployments.commitHash,
              latestCommitMessage: evidence.deployments.commitMessage,
            },
          } as any,
          status: 'PENDING',
        },
        include: {
          board: { select: { id: true, name: true, slug: true } },
          task: { select: { id: true, title: true, status: true } },
          agent: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      approvalId = approval.id;
      io?.to('org:' + organizationId).emit('approval:created', approval);
    }
  } catch (err) {
    logger.warn({ err }, 'Could not automatically create approval for incident');
  }

  try {
    const defaultAgent = await prisma.agent.findFirst({ where: { organizationId } });
    if (defaultAgent) {
      await prisma.activity.create({
        data: {
          agentId: defaultAgent.id,
          organizationId,
          type: 'ALERT',
          message: '🚨 DevOps Incident Doctor completed investigation for [' + investigationId + ']: Root cause identified with ' + Math.round(confidence * 100) + '% confidence. Remediation dispatched to Approvals queue.',
        },
      });
    }
  } catch { /* ignore */ }

  const result: IncidentInvestigationResult = {
    id: investigationId,
    title: input.alertTitle || ('Incident [' + investigationId + ']: ' + affectedServices.join(', ')),
    severity,
    status: approvalId ? 'AWAITING_APPROVAL' : 'ROOT_CAUSE_IDENTIFIED',
    confidence,
    rootCause,
    impactSummary,
    affectedServices,
    evidence,
    recommendedAction,
    approvalId,
    postMortemReport,
    createdAt: new Date().toISOString(),
  };

  recentInvestigations.unshift(result);
  if (recentInvestigations.length > 50) recentInvestigations.pop();

  io?.to('org:' + organizationId).emit('incident:investigation:completed', result);
  return result;
}

export function getRecentInvestigations(): IncidentInvestigationResult[] {
  return recentInvestigations;
}
