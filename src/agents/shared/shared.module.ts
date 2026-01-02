import { Module } from '@nestjs/common';
import { AgentConfigService } from './config/agent-config.service';
import { ModelConfigService } from './llm/model-config.service';
import { OpenAIService } from './llm/openai.service';
import { LLMService } from './llm/llm.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ToolExecutorService } from './tools/tool-executor.service';
import { UrlBuilderService } from './url/url-builder.service';

@Module({
  providers: [
    AgentConfigService,
    ModelConfigService,
    OpenAIService,
    LLMService,
    ToolRegistryService,
    ToolExecutorService,
    UrlBuilderService,
  ],
  exports: [
    AgentConfigService,
    ModelConfigService,
    OpenAIService,
    LLMService,
    ToolRegistryService,
    ToolExecutorService,
    UrlBuilderService,
  ],
})
export class SharedModule {}
