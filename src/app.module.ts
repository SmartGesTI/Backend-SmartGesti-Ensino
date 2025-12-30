import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { SchoolsModule } from './schools/schools.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { InvitationsModule } from './invitations/invitations.module';
import { OwnersModule } from './owners/owners.module';
import { AgentsModule } from './agents/agents.module';
import { TagsModule } from './tags/tags.module';
import { LoggerModule } from './common/logger/logger.module';
import { CacheModule } from './common/cache/cache.module';
import { LoggingInterceptor } from './common/logger/logger.interceptor';
import { TenantIdInterceptor } from './common/interceptors/tenant-id.interceptor';
import { TenantAccessGuard } from './auth/guards/tenant-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    CacheModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    SchoolsModule,
    PermissionsModule,
    RolesModule,
    InvitationsModule,
    OwnersModule,
    AgentsModule,
    TagsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: TenantAccessGuard,
    },
  ],
})
export class AppModule {}
