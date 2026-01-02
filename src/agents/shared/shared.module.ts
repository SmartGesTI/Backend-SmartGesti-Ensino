import { Module } from '@nestjs/common';
import { AgentConfigService } from './config/agent-config.service';
import { ModelConfigService } from './llm/model-config.service';
import { OpenAIService } from './llm/openai.service';
import { LLMService } from './llm/llm.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ToolExecutorService } from './tools/tool-executor.service';

@Module({
  providers: [
    AgentConfigService,
    ModelConfigService,
    OpenAIService,
    LLMService,
    ToolRegistryService,
    ToolExecutorService,
  ],
  exports: [
    AgentConfigService,
    ModelConfigService,
    OpenAIService,
    LLMService,
    ToolRegistryService,
    ToolExecutorService,
  ],
})
export class SharedModule {}
