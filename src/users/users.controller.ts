import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserStatusDto } from './dto/user-status.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private supabaseService: SupabaseService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain?: string,
  ) {
    let dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    // Se o usuário não existe no banco, sincronizar
    if (!dbUser) {
      // IMPORTANTE: Se o JWT indica email não verificado, buscar dados atualizados do Supabase
      // Isso resolve o problema de JWT desatualizado após verificação OTP
      let emailVerified = user.email_verified;
      
      if (!emailVerified) {
        try {
          // Buscar usuário diretamente do Supabase para verificar status atualizado
          const supabase = this.supabaseService.getClient();
          const { data: { user: supabaseUserData }, error } = await supabase.auth.admin.getUserById(user.sub);
          
          if (!error && supabaseUserData) {
            // Verificar se email está confirmado no Supabase
            const hasEmailConfirmed = supabaseUserData.email_confirmed_at !== null && 
                                     supabaseUserData.email_confirmed_at !== undefined;
            const isOAuthUser = supabaseUserData.app_metadata?.provider !== 'email' ||
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
      dbUser = await this.usersService.syncUserFromSupabase(supabaseUser, subdomain);
    }

    return dbUser;
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getUserStatus(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserStatusDto> {
    return this.usersService.getUserStatus(user.sub);
  }

  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  async completeProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CompleteProfileDto,
  ) {
    const updatedUser = await this.usersService.completeProfile(user.sub, dto);
    
    return {
      success: true,
      message: 'Perfil completado com sucesso',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        avatar_url: updatedUser.avatar_url,
        tenant_id: updatedUser.tenant_id, // Incluir tenant_id para redirecionamento correto
        email_verified: updatedUser.email_verified,
      },
    };
  }
}
