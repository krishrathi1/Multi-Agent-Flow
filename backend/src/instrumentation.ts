import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { config } from './config.js';

if (process.env.OTEL_DEBUG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

if (config.otel.enabled && config.otel.endpoint && config.otel.serviceName) {
  const sdk = new NodeSDK({
    serviceName: config.otel.serviceName,
    traceExporter: new OTLPTraceExporter({
      url: `${config.otel.endpoint}/v1/traces`,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${config.otel.endpoint}/v1/metrics`,
      }),
      exportIntervalMillis: 30_000,
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: `${config.otel.endpoint}/v1/logs` }),
      ),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  sdk.start();
  process.on('SIGTERM', () => sdk.shutdown());
  process.on('SIGINT', () => sdk.shutdown());
}
