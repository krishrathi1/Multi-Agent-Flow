import pino from 'pino';
import { trace } from '@opentelemetry/api';

const isProduction = process.env.NODE_ENV === 'production';

// Log directly to stdout (synchronous destination).
// Traces and metrics flow to SigNoz via the OTel SDK in instrumentation.ts.
// Logs include trace_id/span_id for correlation in SigNoz.
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Inject trace context into every log line
  mixin() {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        trace_flags: `0${spanContext.traceFlags.toString(16)}`,
      };
    }
    return {};
  },
});

export default logger;
