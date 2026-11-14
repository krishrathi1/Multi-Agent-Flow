import { Router } from 'express';
import { getTraceWaterfall, getRecentTraces, startSpan, endSpan } from '../services/observability.service.js';

export const observabilityRouter = Router();

observabilityRouter.get('/traces', (_req, res) => {
  const traces = getRecentTraces(20);
  res.json({ ok: true, count: traces.length, traces });
});

observabilityRouter.get('/traces/:traceId', (req, res) => {
  const spans = getTraceWaterfall(req.params.traceId);
  if (!spans.length) {
    return res.status(404).json({ ok: false, error: 'Trace not found' });
  }
  res.json({ ok: true, traceId: req.params.traceId, total_spans: spans.length, spans });
});

observabilityRouter.post('/sample-trace', (_req, res) => {
  // Generates a mock multi-agent execution trace demonstrating provenance
  const rootSpan = startSpan('ProcessRun: E-Commerce Architecture', {
    service: 'MAS-Orchestrator',
    attributes: { processId: 'proc-ecom-1' },
  });

  const span1 = startSpan('Agent: System Architect Planning', {
    traceId: rootSpan.traceId,
    parentSpanId: rootSpan.spanId,
    service: 'CrewAI-Engine',
    agentId: 'agent-arch-01',
    agentRole: 'Architect',
    stage: 1,
  });
  endSpan(span1, 'OK', { tokens: 1200 });

  const span2 = startSpan('ToolCall: research_web_search', {
    traceId: rootSpan.traceId,
    parentSpanId: span1.spanId,
    service: 'MCP-Research-Server',
    attributes: { query: 'Next.js 15 app router best practices' },
  });
  endSpan(span2, 'OK', { latency_ms: 320 });

  const span3 = startSpan('Agent: Lead Developer Code Gen', {
    traceId: rootSpan.traceId,
    parentSpanId: rootSpan.spanId,
    service: 'Google-ADK-Engine',
    agentId: 'agent-dev-02',
    agentRole: 'Developer',
    stage: 2,
  });
  endSpan(span3, 'OK', { tokens: 2850 });

  endSpan(rootSpan, 'OK', { total_duration_ms: 1250 });

  res.json({
    ok: true,
    message: 'Sample distributed trace generated with full provenance',
    traceId: rootSpan.traceId,
    trace_url: `/api/observability/traces/${rootSpan.traceId}`,
  });
});
