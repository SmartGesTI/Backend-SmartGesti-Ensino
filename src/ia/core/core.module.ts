import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../supabase/supabase.module';

// Config
import { CoreConfigService } from './config/core-config.service';
import { ModelConfigService } from './config/model-config.service';
import { AgentConfigService } from './config/agent-config.service';

// Context
import { ContextBuilder } from './context/context.builder';
import { ContextProvider } from './context/context.provider';

// Agent
import { AgentFactory } from './agent/agent.factory';
import { AgentRegistry } from './agent/agent.registry';
import { AgentBuilder } from './agent/agent.builder';

// Tool
import { ToolFactory } from './tool/tool.factory';
import { ToolRegistry } from './tool/tool.registry';
import { ToolBuilder } from './tool/tool.builder';
import { LegacyToolAdapter } from './tool/adapters/legacy-tool.adapter';
import { RagToolAdapter } from './tool/adapters/rag-tool.adapter';

// Session
import { SessionFactory } from './session/session.factory';
import { SessionRegistry } from './session/session.registry';

// Runner
import { AgentRunnerService } from './runner/agent-runner.service';
import { StreamRunnerService } from './runner/stream-runner.service';
import { BatchRunnerService } from './runner/batch-runner.service';

// Guardrails
import { GuardrailFactory } from './guardrails/guardrail.factory';

/**
 * Módulo principal do Core IA
 * Fornece todos os serviços e factories para criação e execução de agentes
 */
@Global()
@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [
    // Config
    CoreConfigService,
    ModelConfigService,
    AgentConfigService,
    // Context
    ContextBuilder,
    ContextProvider,
    // Agent
    AgentRegistry,
    AgentFactory,
    AgentBuilder,
    // Tool
    ToolRegistry,
    ToolFactory,
    ToolBuilder,
    LegacyToolAdapter,
    RagToolAdapter,
    // Session
    SessionRegistry,
    SessionFactory,
    // Runner
    AgentRunnerService,
    StreamRunnerService,
    BatchRunnerService,
    // Guardrails
    GuardrailFactory,
  ],
  exports: [
    // Config
    CoreConfigService,
    ModelConfigService,
    AgentConfigService,
    // Context
    ContextBuilder,
    ContextProvider,
    // Agent
    AgentRegistry,
    AgentFactory,
    AgentBuilder,
    // Tool
    ToolRegistry,
    ToolFactory,
    ToolBuilder,
    LegacyToolAdapter,
    RagToolAdapter,
    // Session
    SessionRegistry,
    SessionFactory,
    // Runner
    AgentRunnerService,
    StreamRunnerService,
    BatchRunnerService,
    // Guardrails
    GuardrailFactory,
  ],
})
export class CoreModule {}
