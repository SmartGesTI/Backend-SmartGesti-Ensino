import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('[JwtAuthGuard] Authorization header:', authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : 'MISSING');

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      console.log('[JwtAuthGuard] Authentication failed:', {
        error: err?.message || 'No error',
        info: info?.message || info || 'No info',
        userExists: !!user,
      });
      throw err || new UnauthorizedException(info?.message || 'Unauthorized');
    }
    console.log('[JwtAuthGuard] Authentication successful for:', user.sub);
    return user;
  }
}
