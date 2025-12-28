import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const auth0Domain = configService.get<string>('AUTH0_DOMAIN');
    const auth0Audience = configService.get<string>('AUTH0_AUDIENCE');

    if (!auth0Domain || !auth0Audience) {
      throw new Error('Missing Auth0 environment variables');
    }

    const strategyOptions: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      }),
      audience: auth0Audience,
      issuer: `https://${auth0Domain}/`,
      algorithms: ['RS256'],
    };

    super(strategyOptions);
  }

  async validate(payload: any): Promise<CurrentUserPayload> {
    console.log('[JwtStrategy] Validating token payload:', JSON.stringify(payload, null, 2));
    
    if (!payload.sub) {
      console.log('[JwtStrategy] Token missing sub claim');
      throw new UnauthorizedException('Invalid token payload: missing sub');
    }

    // Auth0 tokens may have email in different locations or not at all for M2M tokens
    // For user tokens from Google, email is usually present
    const email = payload.email || payload['https://smartgesti.com/email'] || '';
    const name = payload.name || payload['https://smartgesti.com/name'] || '';
    const picture = payload.picture || payload['https://smartgesti.com/picture'] || '';

    console.log('[JwtStrategy] Token validated successfully for:', payload.sub);

    return {
      sub: payload.sub,
      email: email,
      name: name,
      picture: picture,
      email_verified: payload.email_verified ?? false,
    };
  }
}
