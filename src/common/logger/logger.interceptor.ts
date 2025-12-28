import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = headers['x-forwarded-for'] || request.ip || 'unknown';
    const startTime = Date.now();

    const logContext = `${method} ${url}`;

    // Não logar requisições duplicadas ou de health check
    const shouldSkipLog = 
      url.includes('/health') || 
      url.includes('/favicon.ico') ||
      headers['x-skip-log'] === 'true';

    // Log da requisição apenas em modo debug
    if (!shouldSkipLog && process.env.LOG_LEVEL === 'debug') {
      this.logger.debug('Incoming request', logContext, {
        method,
        url,
        query,
        params,
        body: this.sanitizeBody(body),
        userAgent,
        ip,
      });
    }

    return next.handle().pipe(
      tap((data) => {
        if (shouldSkipLog) return;
        
        const responseTime = Date.now() - startTime;
        const statusCode = context.switchToHttp().getResponse().statusCode;
        
        // Apenas logar requisições lentas (> 1s) ou em modo debug
        if (responseTime > 1000 || process.env.LOG_LEVEL === 'debug') {
          this.logger.log('Request completed', logContext, {
            method,
            url,
            statusCode,
            responseTime: `${responseTime}ms`,
          });
        }
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        
        // SEMPRE logar erros
        this.logger.error(
          `Request failed: ${error.message}`,
          error.stack,
          logContext,
          {
            method,
            url,
            statusCode: error.status || 500,
            error: error.message,
            responseTime: `${responseTime}ms`,
            body: this.sanitizeBody(body),
            query,
            params,
          },
        );
        
        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    // Remover campos sensíveis
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });
    return sanitized;
  }
}
