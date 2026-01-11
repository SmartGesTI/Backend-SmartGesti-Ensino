import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../supabase/supabase.module';
import { LoggerModule } from '../../common/logger/logger.module';
import { RagModule } from '../../rag/rag.module';
import { KnowledgeRetrievalService } from '../../ia/retrieval/knowledge-retrieval.service';

// Config
import { AiCoreConfigService } from './ai-core.config';
import { ModelProviderConfigService } from './model-provider.config';

// Providers
import { ModelProviderFactory } from '../providers/model-provider.factory';

// Streaming
import { StreamService } from '../streaming/stream.service';
import { StreamAdapterService } from '../streaming/stream-adapter.service';
import { UIChatService } from '../streaming/ui-chat.service';

// Structured
import { StructuredOutputService } from '../structured/structured-output.service';

// Memory
import { MemoryService } from '../memory/memory.service';
import { SupabaseMemoryService } from '../memory/supabase-memory.service';

// Cache
import { AiCacheService } from '../cache/ai-cache.service';
import { ModelCacheService } from '../cache/model-cache.service';

// Tools
import { ToolFactory } from '../tools/tool.factory';
import { ToolRegistry } from '../tools/tool.registry';
import { RAGTool } from '../tools/rag.tool';
import { DatabaseTool } from '../tools/database.tool';
import { NavigationTool } from '../tools/navigation.tool';
import { UserDataTool } from '../tools/user-data.tool';
import { AgentsTool } from '../tools/agents.tool';

// Agents
import { AgentFactory } from '../agents/agent.factory';
import { AgentRegistry } from '../agents/agent.registry';
import { SupportAgent } from '../agents/support-agent';
import { EducaIAAgent } from '../agents/educa-ia.agent';

// Workflows
import { WorkflowService } from '../workflows/workflow.service';
import { WorkflowExecutorService } from '../workflows/workflow-executor.service';

@Global()
@Module({
  imports: [ConfigModule, SupabaseModule, LoggerModule, RagModule],
  providers: [
    // Config
    AiCoreConfigService,
    ModelProviderConfigService,
    // Providers
    ModelProviderFactory,
    // Streaming
    StreamService,
    StreamAdapterService,
    UIChatService,
    // Structured
    StructuredOutputService,
    // Memory
    SupabaseMemoryService,
    MemoryService,
    // Cache
    AiCacheService,
    ModelCacheService,
    // Tools
    KnowledgeRetrievalService,
    ToolFactory,
    ToolRegistry,
    RAGTool,
    DatabaseTool,
    NavigationTool,
    UserDataTool,
    AgentsTool,
    // Agents
    AgentFactory,
    AgentRegistry,
    SupportAgent,
    EducaIAAgent,
    // Workflows
    WorkflowExecutorService,
    WorkflowService,
  ],
  exports: [
    // Config
    AiCoreConfigService,
    ModelProviderConfigService,
    // Providers
    ModelProviderFactory,
    // Streaming
    StreamService,
    StreamAdapterService,
    UIChatService,
    // Structured
    StructuredOutputService,
    // Memory
    MemoryService,
    // Cache
    AiCacheService,
    ModelCacheService,
    // Tools
    ToolFactory,
    ToolRegistry,
    RAGTool,
    DatabaseTool,
    NavigationTool,
    UserDataTool,
    AgentsTool,
    // Agents
    AgentFactory,
    AgentRegistry,
    SupportAgent,
    EducaIAAgent,
    // Workflows
    WorkflowService,
    WorkflowExecutorService,
  ],
})
export class AiCoreModule {}
