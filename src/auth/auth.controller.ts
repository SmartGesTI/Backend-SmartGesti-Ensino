import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private supabaseService: SupabaseService,
  ) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain?: string,
  ) {
    // IMPORTANTE: Se o JWT indica email não verificado, buscar dados atualizados do Supabase
    // Isso resolve o problema de JWT desatualizado após verificação OTP
    let emailVerified = user.email_verified;

    if (!emailVerified) {
      try {
        // Buscar usuário diretamente do Supabase para verificar status atualizado
        // Usar Service Key (já configurado no SupabaseService) para acessar Admin API
        const supabase = this.supabaseService.getClient();
        const {
          data: { user: supabaseUserData },
          error,
        } = await supabase.auth.admin.getUserById(user.sub);

        if (!error && supabaseUserData) {
          // Verificar se email está confirmado no Supabase
          const hasEmailConfirmed =
            supabaseUserData.email_confirmed_at !== null &&
            supabaseUserData.email_confirmed_at !== undefined;
          const isOAuthUser =
            supabaseUserData.app_metadata?.provider !== 'email' ||
            supabaseUserData.user_metadata?.provider === 'google';

          emailVerified = hasEmailConfirmed || isOAuthUser;
        }
      } catch (error) {
        // Se falhar ao buscar do Supabase, usar valor do JWT
        // Não bloquear a sincronização
      }
    }

    const supabaseUser = {
      id: user.sub, // UUID do Supabase
      email: user.email,
      name: user.name,
      picture: user.picture,
      email_verified: emailVerified, // Usar valor atualizado
    };

    const syncedUser = await this.authService.syncUser(supabaseUser, subdomain);
    return { user: syncedUser };
  }
}
