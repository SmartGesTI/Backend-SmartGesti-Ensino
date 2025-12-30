import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Aumentar limite do body-parser para documentos grandes (50MB)
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Adicionar filtro global de exceções para capturar TODOS os erros
  app.useGlobalFilters(new AllExceptionsFilter(logger));

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
    await app.close();
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully', 'Bootstrap');
    await app.close();
  });
}
bootstrap();
