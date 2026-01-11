import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import {
  EmbeddingService,
  ChunkService,
  SearchService,
  IngestionService,
  RagAssistantService,
  FeedbackService,
} from './services';

// Tools
import { SemanticSearchTool, RagToolsService } from './tools';

// Controller
import { RagController } from './rag.controller';

// Common
import { LoggerModule } from '../../common/logger/logger.module';
import { SharedModule } from '../../agents/shared/shared.module';

@Module({
  imports: [ConfigModule, LoggerModule, SharedModule],
  controllers: [RagController],
  providers: [
    // Services
    EmbeddingService,
    ChunkService,
    SearchService,
    IngestionService,
    RagAssistantService,
    FeedbackService,
    // Tools
    SemanticSearchTool,
    RagToolsService,
  ],
  exports: [
    // Exportar serviços para uso em outros módulos
    EmbeddingService,
    SearchService,
    IngestionService,
    RagAssistantService,
    FeedbackService,
    SemanticSearchTool,
  ],
})
export class RagModule {}
