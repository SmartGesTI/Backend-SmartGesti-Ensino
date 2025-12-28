import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ServiceKeyGuard } from './service-key.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    LoggerModule,
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, ServiceKeyGuard],
  exports: [JwtStrategy, PassportModule, ServiceKeyGuard],
})
export class AuthModule {}
