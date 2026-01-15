import { Module } from '@nestjs/common';
import { EducaIAController } from './educa-ia.controller';
import { EducaIAService } from './educa-ia.service';
import { FeedbackService } from './feedback.service';
import { AiCoreModule } from '../config/ai-core.module';

/**
 * EducaIA Module
 *
 * Imports AiCoreModule which provides:
 * - EducaIAAgent
 * - RAGTool, DatabaseTool, NavigationTool, UserDataTool
 * - MemoryService, ModelProviderFactory, etc.
 */
@Module({
  imports: [AiCoreModule],
  controllers: [EducaIAController],
  providers: [EducaIAService, FeedbackService],
  exports: [EducaIAService, FeedbackService],
})
export class EducaIAModule {}
