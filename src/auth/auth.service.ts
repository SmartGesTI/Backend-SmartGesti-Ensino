import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Auth0User } from '../common/types';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async syncUser(auth0User: Auth0User, subdomain?: string) {
    return this.usersService.syncUserFromAuth0(auth0User, subdomain);
  }
}
