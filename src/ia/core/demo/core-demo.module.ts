import { Module } from '@nestjs/common';
import { CoreModule } from '../core.module';
import { RagModule } from '../../../rag/rag.module';
import { CoreDemoService } from './core-demo.service';
import { CoreDemoController } from './core-demo.controller';

/**
 * Módulo para demo do Core IA
 */
@Module({
  imports: [CoreModule, RagModule],
  controllers: [CoreDemoController],
  providers: [CoreDemoService],
  exports: [CoreDemoService],
})
export class CoreDemoModule {}
