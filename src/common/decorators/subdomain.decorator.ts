import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Subdomain = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    // Extrair subdomain do header X-Tenant-Subdomain ou do hostname
    const subdomain = request.headers['x-tenant-subdomain'];
    if (subdomain) {
      return subdomain;
    }
    // Fallback: extrair do hostname se disponível
    const hostname = request.headers['host'] || request.hostname;
    if (hostname) {
      const parts = hostname.split('.');
      if (parts.length >= 3 && parts[0] !== 'www') {
        return parts[0];
      }
    }
    return undefined;
  },
);
