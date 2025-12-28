import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../common/logger/logger.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ServiceKeyGuard } from './service-key.guard';
import { TenantAccessGuard } from './guards/tenant-access.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    LoggerModule,
    SupabaseModule,
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, ServiceKeyGuard, TenantAccessGuard],
  exports: [JwtStrategy, PassportModule, ServiceKeyGuard, TenantAccessGuard],
})
export class AuthModule {}
