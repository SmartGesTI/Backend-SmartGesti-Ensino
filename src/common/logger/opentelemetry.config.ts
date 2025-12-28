import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';

let sdk: NodeSDK | null = null;

export function initializeOpenTelemetry(posthogToken?: string, posthogHost?: string) {
  if (!posthogToken) {
    console.warn('PostHog token not provided, OpenTelemetry logging disabled');
    return;
  }

  const url = posthogHost 
    ? `${posthogHost}/i/v1/logs`
    : 'https://us.i.posthog.com/i/v1/logs';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'smartgesti-ensino-backend',
      'service.version': process.env.npm_package_version || '1.0.0',
      'deployment.environment': process.env.NODE_ENV || 'development',
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url,
        headers: {
          Authorization: `Bearer ${posthogToken}`,
        },
      }),
    ),
  });

  sdk.start();
  console.log('OpenTelemetry SDK initialized for PostHog logs');
}

export function shutdownOpenTelemetry() {
  if (sdk) {
    sdk.shutdown();
    sdk = null;
  }
}
