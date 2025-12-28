import { Injectable, LoggerService as NestLoggerService, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import { logs } from '@opentelemetry/api-logs';
import * as winston from 'winston';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

@Injectable()
export class LoggerService implements NestLoggerService, OnModuleDestroy {
  private posthog: PostHog | null = null;
  private winstonLogger: winston.Logger;
  private otelLogger: any = null;

  constructor(private configService: ConfigService) {
    // Configurar Winston
    this.winstonLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
          const contextStr = context ? `[${context}]` : '';
          const traceStr = trace ? `\n${trace}` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}${metaStr}${traceStr}`;
        }),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
              const contextStr = context ? `[${context}]` : '';
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} ${level} ${contextStr} ${message}${metaStr}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });

    // Configurar PostHog se disponível
    const posthogApiKey = this.configService.get<string>('POSTHOG_API_KEY');
    const posthogHost = this.configService.get<string>('POSTHOG_HOST') || 'https://us.i.posthog.com';

    if (posthogApiKey) {
      this.posthog = new PostHog(posthogApiKey, {
        host: posthogHost,
        flushAt: 20,
        flushInterval: 10000,
      });
      this.winstonLogger.info('PostHog initialized', { context: 'LoggerService' });
    } else {
      this.winstonLogger.warn('PostHog API key not found, analytics disabled', {
        context: 'LoggerService',
      });
    }

    // Configurar OpenTelemetry Logger se disponível
    try {
      this.otelLogger = logs.getLogger('smartgesti-ensino-backend');
    } catch (error) {
      // OpenTelemetry pode não estar inicializado ainda
      this.winstonLogger.debug('OpenTelemetry logger not available yet', {
        context: 'LoggerService',
      });
    }
  }

  log(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.info(message, { context, ...meta });
    this.sendToPostHog('info', message, context, meta);
    this.sendToOpenTelemetry('INFO', message, context, meta);
  }

  error(message: string, trace?: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.error(message, { context, trace, ...meta });
    this.sendToPostHog('error', message, context, { ...meta, trace });
    this.sendToOpenTelemetry('ERROR', message, context, { ...meta, trace });
  }

  warn(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.warn(message, { context, ...meta });
    this.sendToPostHog('warn', message, context, meta);
    this.sendToOpenTelemetry('WARN', message, context, meta);
  }

  debug(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.debug(message, { context, ...meta });
    this.sendToPostHog('debug', message, context, meta);
    this.sendToOpenTelemetry('DEBUG', message, context, meta);
  }

  verbose(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.verbose(message, { context, ...meta });
    this.sendToPostHog('verbose', message, context, meta);
    this.sendToOpenTelemetry('TRACE', message, context, meta);
  }

  private sendToPostHog(
    level: string,
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    if (!this.posthog) return;

    const eventName = `backend_${level}`;
    const properties = {
      message,
      context: context || 'unknown',
      level,
      environment: process.env.NODE_ENV || 'development',
      ...meta,
    };

    // Enviar para PostHog (sem userId específico para logs do sistema)
    this.posthog.capture({
      distinctId: 'backend-server',
      event: eventName,
      properties,
    });
  }

  private sendToOpenTelemetry(
    severityText: string,
    message: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    if (!this.otelLogger) return;

    try {
      this.otelLogger.emit({
        severityText,
        body: message,
        attributes: {
          context: context || 'unknown',
          ...meta,
        },
      });
    } catch (error) {
      // Silenciosamente falha se OpenTelemetry não estiver disponível
    }
  }

  async onModuleDestroy() {
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }
}
