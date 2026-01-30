import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import * as bodyParser from 'body-parser';
import { Request, Response, NextFunction } from 'express';

function isAllowedCorsOrigin(origin: string): boolean {
  const allowed = [
    'https://smartgesti.com.br',
    'https://www.smartgesti.com.br',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  if (allowed.includes(origin)) return true;
  if (origin.startsWith('https://') && origin.endsWith('.smartgesti.com.br'))
    return true;
  if (origin.startsWith('http://') && origin.endsWith('.localhost:5173'))
    return true;
  if (origin.endsWith('.vercel.app')) return true;
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // CORS preflight: responder OPTIONS antes de qualquer outro middleware (crítico na Vercel).
  // Nota: expressApp.options('*', ...) foi removido porque path-to-regexp v7+ (Express na Vercel)
  // não aceita o path '*' (erro "Missing parameter name at index 1"). O middleware abaixo trata
  // OPTIONS para todas as rotas.
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const rawOrigin = req.headers.origin;
      const origin =
        typeof rawOrigin === 'string'
          ? rawOrigin
          : Array.isArray(rawOrigin)
            ? rawOrigin[0]
            : undefined;
      if (origin && isAllowedCorsOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        );
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-School-Id, X-Tenant-Subdomain, X-Tenant-Id, X-Skip-Interceptor',
        );
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    } catch {
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    }
  });

  // Aumentar limite do body-parser para documentos grandes (50MB)
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Adicionar filtro global de exceções para capturar TODOS os erros
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Adicionar ValidationPipe global para validação de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS (NestJS): mesma lógica para respostas de GET/POST/etc.
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (isAllowedCorsOrigin(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-School-Id',
      'X-Tenant-Subdomain',
      'X-Tenant-Id',
      'X-Skip-Interceptor',
    ],
  });

  // Global prefix for API routes (excluding health check)
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Server listening on http://0.0.0.0:${port}`, 'Bootstrap');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.log('SIGTERM received, shutting down gracefully', 'Bootstrap');
    void app.close();
  });

  process.on('SIGINT', () => {
    logger.log('SIGINT received, shutting down gracefully', 'Bootstrap');
    void app.close();
  });
}
void bootstrap();
