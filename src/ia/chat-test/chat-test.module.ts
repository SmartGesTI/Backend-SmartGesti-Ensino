import { Module } from '@nestjs/common';
import { ChatTestController } from './chat-test.controller';
import { AiCoreModule } from '../../ai-core/config/ai-core.module';

@Module({
  imports: [AiCoreModule],
  controllers: [ChatTestController],
})
export class ChatTestModule {}
