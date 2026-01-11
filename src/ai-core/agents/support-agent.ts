import { Injectable, Logger } from '@nestjs/common';
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';
import { ModelProviderFactory } from '../providers/model-provider.factory';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { AiCoreConfigService } from '../config/ai-core.config';
import { RAGTool } from '../tools/rag.tool';
import { DatabaseTool } from '../tools/database.tool';
import { LanguageModel } from 'ai';

export interface SupportAgentCallOptions {
  tenantId: string;
  userId: string;
  schoolId?: string;
  conversationId?: string;
  userRole?: string;
  userName?: string;
}

export type SupportAgentUIMessage = InferAgentUIMessage<typeof SupportAgent.prototype.agent>;

/**
 * Support Agent using ToolLoopAgent (AI SDK 6)
 * Can decide when to use RAG vs database queries
 * Supports reasoning, memory, and tool approval
 */
@Injectable()
export class SupportAgent {
  private readonly logger = new Logger(SupportAgent.name);
  public readonly agent: ToolLoopAgent<SupportAgentCallOptions>;

  constructor(
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
    private readonly ragTool: RAGTool,
    private readonly databaseTool: DatabaseTool,
  ) {
    // Get default model
    const provider = this.aiConfig.getDefaultProvider();
    const modelName = this.modelConfig.getProvider(provider)?.defaultModel || 'gpt-5-mini';
    const model = this.providerFactory.getModel(provider, modelName);

    if (!model) {
      throw new Error(`Model ${modelName} not available for provider ${provider}`);
    }

    // Create agent with call options schema for type-safe runtime configuration
    this.agent = new ToolLoopAgent<SupportAgentCallOptions>({
      model,
      instructions: `Você é um assistente de suporte especializado do SmartGesTI Ensino.
Você ajuda usuários com perguntas sobre o sistema, funcionalidades, APIs, e dados.

DIRETRIZES:
- Use a tool retrieveKnowledge quando precisar de informações sobre funcionalidades, APIs, páginas ou documentação do sistema
- Use a tool queryDatabase quando precisar consultar dados específicos do sistema (usuários, escolas, configurações)
- Seja claro e objetivo nas respostas
- Se não tiver certeza, busque na base de conhecimento primeiro
- Para operações sensíveis no banco de dados, sempre peça aprovação do usuário

Quando usar cada tool:
- retrieveKnowledge: Para informações sobre como o sistema funciona, APIs disponíveis, páginas, configurações gerais
- queryDatabase: Para informações específicas sobre dados do sistema (ex: "quantos usuários temos?", "quais escolas estão cadastradas?")`,
      callOptionsSchema: z.object({
        tenantId: z.string().describe('ID do tenant (obrigatório)'),
        userId: z.string().describe('ID do usuário (obrigatório)'),
        schoolId: z.string().optional().describe('ID da escola (opcional)'),
        conversationId: z.string().optional().describe('ID da conversa para contexto'),
        userRole: z.string().optional().describe('Papel do usuário (ex: admin, teacher, student)'),
        userName: z.string().optional().describe('Nome do usuário'),
      }),
      prepareCall: ({ options, ...settings }) => {
        // Inject user context into instructions
        const userContext = [
          options.userName && `Usuário: ${options.userName}`,
          options.userRole && `Papel: ${options.userRole}`,
          options.schoolId && `Escola ID: ${options.schoolId}`,
        ]
          .filter(Boolean)
          .join(', ');

        const enhancedInstructions = userContext
          ? `${settings.instructions}\n\nContexto do usuário: ${userContext}`
          : settings.instructions;

        // Create tools with context
        const tools: Record<string, any> = {};
        tools.retrieveKnowledge = this.ragTool.createTool({
          tenantId: options.tenantId,
          userId: options.userId,
          schoolId: options.schoolId,
        });
        tools.queryDatabase = this.databaseTool.createTool({
          tenantId: options.tenantId,
          userId: options.userId,
          schoolId: options.schoolId,
        });

        return {
          ...settings,
          instructions: enhancedInstructions,
          tools,
        };
      },
      // Stop after 20 steps to prevent infinite loops
      stopWhen: stepCountIs(20),
    });

    this.logger.log(`SupportAgent initialized with model ${modelName}`);
  }

  /**
   * Generate response using the agent
   */
  async generate(
    prompt: string,
    options: SupportAgentCallOptions,
  ): Promise<Awaited<ReturnType<typeof this.agent.generate>>> {
    return this.agent.generate({
      prompt,
      options,
    });
  }

  /**
   * Stream response using the agent
   */
  stream(
    prompt: string,
    options: SupportAgentCallOptions,
  ): ReturnType<typeof this.agent.stream> {
    return this.agent.stream({
      prompt,
      options,
    });
  }
}
