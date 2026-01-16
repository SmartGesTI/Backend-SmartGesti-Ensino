import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

// Contexts do NestJS que são muito verbosos durante o bootstrap
const MUTED_CONTEXTS = ['RouterExplorer', 'RoutesResolver', 'InstanceLoader'];

@Injectable()
export class LoggerService implements NestLoggerService {
  private winstonLogger: winston.Logger;

  /**
   * Verifica se o context deve ser silenciado
   */
  private shouldMute(context?: string): boolean {
    if (!context) return false;
    return MUTED_CONTEXTS.includes(context);
  }

  constructor() {
    this.winstonLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        winston.format.printf(
          ({ timestamp, level, message, context, trace, ...meta }) => {
            const contextStr = context ? `[${context}]` : '';
            const traceStr = trace ? `\n${trace}` : '';
            const metaStr = Object.keys(meta).length
              ? ` ${JSON.stringify(meta)}`
              : '';
            return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}${metaStr}${traceStr}`;
          },
        ),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, context, ...meta }) => {
                const contextStr = context ? `[${context}]` : '';
                const metaStr = Object.keys(meta).length
                  ? ` ${JSON.stringify(meta)}`
                  : '';
                return `${timestamp} ${level} ${contextStr} ${message}${metaStr}`;
              },
            ),
          ),
        }),
      ],
    });
  }

  log(message: string, context?: string, meta?: Record<string, any>) {
    // Silencia logs verbosos do bootstrap do NestJS
    if (this.shouldMute(context)) return;
    this.winstonLogger.info(message, { context, ...meta });
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    meta?: Record<string, any>,
  ) {
    this.winstonLogger.error(message, { context, trace, ...meta });
  }

  warn(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.warn(message, { context, ...meta });
  }

  debug(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.debug(message, { context, ...meta });
  }

  verbose(message: string, context?: string, meta?: Record<string, any>) {
    this.winstonLogger.verbose(message, { context, ...meta });
  }
}
