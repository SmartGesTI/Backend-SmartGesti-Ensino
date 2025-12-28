import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(
    private supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      // Decodificar header do JWT para verificar algoritmo
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'),
      );

      let payload: any;

      // Se for ES256 (ECC), validar via Supabase Client
      if (header.alg === 'ES256') {
        const supabase = this.supabaseService.getClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          throw new UnauthorizedException('Invalid ES256 token');
        }

        // Decodificar payload (sem verificar assinatura, já validamos via Supabase)
        payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'),
        );
      }
      // Se for HS256 (legacy), validar com JWT Secret
      else if (header.alg === 'HS256') {
        const supabaseJwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
        
        if (!supabaseJwtSecret) {
          throw new UnauthorizedException('HS256 token requires SUPABASE_JWT_SECRET');
        }

        payload = jwt.verify(token, supabaseJwtSecret, {
          algorithms: ['HS256'],
        }) as any;
      } else {
        throw new UnauthorizedException(`Unsupported algorithm: ${header.alg}`);
      }

      // Validar payload
      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token payload: missing sub');
      }

      // Adicionar usuário ao request (similar ao que passport-jwt faz)
      request.user = {
        sub: payload.sub,
        email: payload.email || '',
        name: payload.user_metadata?.full_name || payload.user_metadata?.name || '',
        picture: payload.user_metadata?.avatar_url || payload.user_metadata?.picture || '',
        email_verified: payload.email_confirmed_at !== null && payload.email_confirmed_at !== undefined,
      };

      return true;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(`Token validation failed: ${error.message}`);
    }
  }
}
