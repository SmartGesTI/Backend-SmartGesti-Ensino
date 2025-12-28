import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SupabaseUser } from '../common/types';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async syncUser(supabaseUser: SupabaseUser, subdomain?: string) {
    return this.usersService.syncUserFromSupabase(supabaseUser, subdomain);
  }
}
