import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const stack =
      exception instanceof Error ? exception.stack : 'No stack trace';

    // Logar TODOS os erros no error.log
    this.logger.error(
      `[${request.method}] ${request.url} - ${message}`,
      stack,
      'ExceptionFilter',
      {
        statusCode: status,
        method: request.method,
        url: request.url,
        body: request.body,
        query: request.query,
        params: request.params,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );

    // Responder com erro formatado
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }
}
