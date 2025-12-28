import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { initializeOpenTelemetry, shutdownOpenTelemetry } from './common/logger/opentelemetry.config';

// Inicializar OpenTelemetry antes de criar a aplicação
const posthogToken = process.env.POSTHOG_API_KEY;
const posthogHost = process.env.POSTHOG_HOST;
initializeOpenTelemetry(posthogToken, posthogHost);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // CORS configuration
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global prefix for API routes (excluding health check)
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Server listening on http://0.0.0.0:${port}`, 'Bootstrap');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully', 'Bootstrap');
    shutdownOpenTelemetry();
    await app.close();
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully', 'Bootstrap');
    shutdownOpenTelemetry();
    await app.close();
  });
}
bootstrap();
