import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain?: string,
  ) {
    let dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    // Se o usuário não existe no Supabase, sincronizar
    if (!dbUser) {
      const auth0User = {
        sub: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture,
        email_verified: user.email_verified,
      };
      dbUser = await this.usersService.syncUserFromAuth0(auth0User, subdomain);
    }

    return dbUser;
  }
}
