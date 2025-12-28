import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain?: string,
  ) {
    const auth0User = {
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
      email_verified: user.email_verified,
    };

    const syncedUser = await this.authService.syncUser(auth0User, subdomain);
    return { user: syncedUser };
  }
}
