import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private logger: LoggerService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceKey = request.headers['x-service-key'];

    if (!serviceKey) {
      this.logger.warn('Service key missing in request', 'ServiceKeyGuard', {
        path: request.url,
        method: request.method,
      });
      throw new UnauthorizedException('Service key is required');
    }

    const expectedServiceKey = process.env.SERVICE_KEY;

    if (!expectedServiceKey) {
      this.logger.error(
        'SERVICE_KEY environment variable is not set',
        undefined,
        'ServiceKeyGuard',
      );
      throw new UnauthorizedException(
        'Service key validation is not configured',
      );
    }

    // Comparação segura usando timing-safe comparison
    if (!this.secureCompare(serviceKey, expectedServiceKey)) {
      this.logger.warn('Invalid service key provided', 'ServiceKeyGuard', {
        path: request.url,
        method: request.method,
        // Não logar a chave por segurança
      });
      throw new UnauthorizedException('Invalid service key');
    }

    this.logger.log('Service key validated successfully', 'ServiceKeyGuard', {
      path: request.url,
      method: request.method,
    });

    return true;
  }

  /**
   * Comparação segura contra timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
