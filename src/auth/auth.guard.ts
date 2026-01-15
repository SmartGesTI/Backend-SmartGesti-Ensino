import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return super.canActivate(context) as Promise<boolean>;
    }

    const token = authHeader.substring(7);

    try {
      // Decodificar header do JWT para verificar algoritmo
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'),
      );

      // Se for ES256 (ECC), validar via Supabase Client
      if (header.alg === 'ES256') {
        const supabase = this.supabaseService.getClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
          throw new UnauthorizedException('Invalid ES256 token');
        }

        // Decodificar payload
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'),
        );

        // Validar payload
        if (!payload.sub) {
          throw new UnauthorizedException('Invalid token payload: missing sub');
        }

        // Verificar se email está confirmado
        // Para usuários OAuth (Google, etc), considerar email como verificado
        const hasEmailConfirmed =
          payload.email_confirmed_at !== null &&
          payload.email_confirmed_at !== undefined;
        const isOAuthUser =
          payload.app_metadata?.provider !== 'email' ||
          payload.user_metadata?.provider === 'google' ||
          payload.iss?.includes('accounts.google.com');
        const emailVerified = hasEmailConfirmed || isOAuthUser;

        // Adicionar usuário ao request
        request.user = {
          sub: payload.sub,
          email: payload.email || '',
          name:
            payload.user_metadata?.full_name ||
            payload.user_metadata?.name ||
            '',
          picture:
            payload.user_metadata?.avatar_url ||
            payload.user_metadata?.picture ||
            '',
          email_verified: emailVerified,
        };

        return true;
      }

      // Se for HS256, usar passport-jwt (chama super.canActivate)
      // O passport-jwt vai validar com o JWT Secret
      if (header.alg === 'HS256') {
        return super.canActivate(context) as Promise<boolean>;
      }

      throw new UnauthorizedException(`Unsupported algorithm: ${header.alg}`);
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Se falhar, tentar passport-jwt como fallback
      return super.canActivate(context) as Promise<boolean>;
    }
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
