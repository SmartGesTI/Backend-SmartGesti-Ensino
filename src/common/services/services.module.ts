import { Global, Module } from '@nestjs/common';
import { SoftDeleteService } from './soft-delete.service';

@Global()
@Module({
  providers: [SoftDeleteService],
  exports: [SoftDeleteService],
})
export class ServicesModule {}
