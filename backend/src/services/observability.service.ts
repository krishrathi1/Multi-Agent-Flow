import { randomBytes } from 'node:crypto';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  service: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR';
  attributes: Record<string, unknown>;
  provenance: {
    agentId?: string;
    agentRole?: string;
    stage?: number;
    toolCallId?: string;
  };
}

// In-memory trace store for auditability and provenance inspection
const traceStore = new Map<string, TraceSpan[]>();

export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

export function startSpan(
  name: string,
  opts?: {
    traceId?: string;
    parentSpanId?: string;
    service?: string;
    attributes?: Record<string, unknown>;
    agentId?: string;
    agentRole?: string;
    stage?: number;
  }
): TraceSpan {
  const traceId = opts?.traceId || generateTraceId();
  const spanId = generateSpanId();
  const span: TraceSpan = {
    traceId,
    spanId,
    parentSpanId: opts?.parentSpanId,
    name,
    service: opts?.service || 'MAS-Agent-Service',
    startTime: Date.now(),
    status: 'OK',
    attributes: opts?.attributes || {},
    provenance: {
      agentId: opts?.agentId,
      agentRole: opts?.agentRole,
      stage: opts?.stage,
    },
  };

  if (!traceStore.has(traceId)) {
    traceStore.set(traceId, []);
  }
  traceStore.get(traceId)!.push(span);
  return span;
}

export function endSpan(span: TraceSpan, status: 'OK' | 'ERROR' = 'OK', extraAttrs?: Record<string, unknown>): TraceSpan {
  span.endTime = Date.now();
  span.durationMs = span.endTime - span.startTime;
  span.status = status;
  if (extraAttrs) {
    span.attributes = { ...span.attributes, ...extraAttrs };
  }
  return span;
}

export function getTraceWaterfall(traceId: string): TraceSpan[] {
  return traceStore.get(traceId) || [];
}

export function getRecentTraces(limit = 10): Array<{ traceId: string; spanCount: number; rootSpan: string; startTime: number }> {
  const list: Array<{ traceId: string; spanCount: number; rootSpan: string; startTime: number }> = [];
  for (const [traceId, spans] of traceStore.entries()) {
    if (spans.length > 0) {
      list.push({
        traceId,
        spanCount: spans.length,
        rootSpan: spans[0].name,
        startTime: spans[0].startTime,
      });
    }
  }
  return list.sort((a, b) => b.startTime - a.startTime).slice(0, limit);
}
