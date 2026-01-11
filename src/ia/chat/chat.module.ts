import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { AiCoreModule } from '../../ai-core/config/ai-core.module';

@Module({
  imports: [AiCoreModule],
  controllers: [ChatController],
})
export class ChatModule {}
