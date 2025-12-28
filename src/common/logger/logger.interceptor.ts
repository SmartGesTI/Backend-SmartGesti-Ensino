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

    // Log da requisição
    this.logger.debug('Incoming request', logContext, {
      method,
      url,
      query,
      params,
      body: this.sanitizeBody(body),
      userAgent,
      ip,
    });

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - startTime;
        this.logger.log('Request completed', logContext, {
          method,
          url,
          statusCode: context.switchToHttp().getResponse().statusCode,
          responseTime: `${responseTime}ms`,
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        this.logger.error(
          'Request failed',
          error.stack,
          logContext,
          {
            method,
            url,
            statusCode: error.status || 500,
            error: error.message,
            responseTime: `${responseTime}ms`,
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
