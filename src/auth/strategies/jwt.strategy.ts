import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const supabaseJwtSecret = configService.get<string>('SUPABASE_JWT_SECRET');

    if (!supabaseJwtSecret) {
      throw new Error('Missing SUPABASE_JWT_SECRET environment variable');
    }

    // Esta estratégia valida apenas tokens HS256 (legacy)
    // Tokens ES256 são validados no JwtAuthGuard antes de chegar aqui
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: supabaseJwtSecret,
      algorithms: ['HS256'], // Apenas HS256 (legacy)
    });
  }

  async validate(payload: any): Promise<CurrentUserPayload> {
    console.log('[JwtStrategy] Validating token payload:', JSON.stringify(payload, null, 2));
    
    if (!payload.sub) {
      console.log('[JwtStrategy] Token missing sub claim');
      throw new UnauthorizedException('Invalid token payload: missing sub');
    }

    // Payload do Supabase tem estrutura diferente do Auth0
    // sub é o UUID do usuário (não mais auth0|xxx)
    const userId = payload.sub;
    const email = payload.email || '';
    const name = payload.user_metadata?.full_name || payload.user_metadata?.name || '';
    const picture = payload.user_metadata?.avatar_url || payload.user_metadata?.picture || '';
    
    // Verificar se email está confirmado
    // Para usuários OAuth (Google, etc), considerar email como verificado
    // pois o provedor OAuth já faz essa verificação
    const hasEmailConfirmed = payload.email_confirmed_at !== null && payload.email_confirmed_at !== undefined;
    const isOAuthUser = payload.app_metadata?.provider !== 'email' || 
                       payload.user_metadata?.provider === 'google' ||
                       payload.iss?.includes('accounts.google.com');
    const emailVerified = hasEmailConfirmed || isOAuthUser;

    console.log('[JwtStrategy] Token validated successfully for:', userId);

    return {
      sub: userId, // UUID do Supabase
      email: email,
      name: name,
      picture: picture,
      email_verified: emailVerified,
    };
  }
}
