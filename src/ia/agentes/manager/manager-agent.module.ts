import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { ManagerAgentService } from './manager-agent.service';

/**
 * Módulo do ManagerAgent
 */
@Module({
  imports: [CoreModule],
  providers: [ManagerAgentService],
  exports: [ManagerAgentService],
})
export class ManagerAgentModule {}
