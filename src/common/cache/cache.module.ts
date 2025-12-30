import { Global, Module } from '@nestjs/common';
import { TenantCacheService } from './tenant-cache.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [TenantCacheService],
  exports: [TenantCacheService],
})
export class CacheModule {}
