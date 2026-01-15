import { Injectable, Logger } from '@nestjs/common';
import { generateText, stepCountIs } from 'ai';
import { ModelMessage } from '@ai-sdk/provider-utils';
import { ModelProviderFactory } from '../providers/model-provider.factory';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { AiCoreConfigService } from '../config/ai-core.config';
import { MemoryService } from '../memory/memory.service';
import { StreamService } from '../streaming/stream.service';
import { StructuredOutputService } from '../structured/structured-output.service';
import { AgentConfig, AgentContext, AgentResult } from './agent.interface';
import { BaseAgent } from './base.agent';

@Injectable()
export class AgentFactory {
  private readonly logger = new Logger(AgentFactory.name);

  constructor(
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
    private readonly memory: MemoryService,
    private readonly streamService: StreamService,
    private readonly structuredOutput: StructuredOutputService,
  ) {}

  /**
   * Cria um agente simples
   */
  createAgent(config: AgentConfig): BaseAgent {
    this.logger.debug(`Creating agent: ${config.name}`);

    return new SimpleAgent(
      config,
      this.providerFactory,
      this.modelConfig,
      this.aiConfig,
      this.memory,
      this.streamService,
    );
  }
}

/**
 * Implementação simples de agente
 */
class SimpleAgent extends BaseAgent {
  private readonly logger = new Logger(SimpleAgent.name);

  constructor(
    config: AgentConfig,
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
    private readonly memory: MemoryService,
    private readonly streamService: StreamService,
  ) {
    super(config);
    this.validateConfig();
  }

  async execute(
    prompt: string | ModelMessage[],
    context?: AgentContext,
  ): Promise<AgentResult> {
    const provider = this.config.provider || this.aiConfig.getDefaultProvider();
    const modelName =
      this.config.model || this.modelConfig.getProvider(provider)?.defaultModel;

    if (!modelName) {
      throw new Error(`No model specified for agent ${this.config.name}`);
    }

    // Recuperar histórico se houver contexto
    let messages: ModelMessage[] = [];
    if (context) {
      messages = await this.memory.getMessages(context);
    }

    // Adicionar system prompt se houver
    if (this.config.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // Adicionar prompt atual
    if (typeof prompt === 'string') {
      messages.push({
        role: 'user',
        content: prompt,
      });
    } else {
      messages.push(...prompt);
    }

    // Executar com streaming e coletar resultado
    const model = this.providerFactory.getModel(provider, modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not available`);
    }

    // Apply timeout and retries
    const timeout = this.aiConfig.getTimeout();
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      this.logger.warn(`Agent execution timeout after ${timeout}ms`);
    }, timeout);

    const startTime = Date.now();

    try {
      const result = await generateText({
        model,
        messages,
        tools: this.config.tools,
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        maxRetries: this.aiConfig.getMaxRetries(),
        abortSignal: abortController.signal,
        stopWhen: this.config.maxToolRoundtrips
          ? stepCountIs(this.config.maxToolRoundtrips)
          : undefined,
      });

      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - startTime;

      // Log telemetry
      const tokenCount = result.usage
        ? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
        : undefined;
      this.logger.debug(
        `Agent ${this.config.name} completed: ${elapsedTime}ms, tokens: ${
          tokenCount ?? 'N/A'
        }`,
      );

      // Salvar mensagens na memória se houver contexto
      if (context) {
        await this.memory.addMessage(context, {
          role: 'user',
          content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
        });
        await this.memory.addMessage(context, {
          role: 'assistant',
          content: result.text,
        });
      }

      // Converter usage para o formato esperado
      const usage = result.usage
        ? {
            promptTokens: result.usage.inputTokens || 0,
            completionTokens: result.usage.outputTokens || 0,
            totalTokens:
              (result.usage.inputTokens || 0) +
              (result.usage.outputTokens || 0),
          }
        : undefined;

      return {
        text: result.text,
        messages: result.response.messages,
        usage,
        // toolCalls não está mais disponível diretamente em result.response
        // Será necessário extrair das mensagens se necessário
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - startTime;
      this.logger.error(
        `Agent ${this.config.name} error after ${elapsedTime}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async *stream(
    prompt: string | ModelMessage[],
    context?: AgentContext,
  ): AsyncIterable<AgentResult> {
    const provider = this.config.provider || this.aiConfig.getDefaultProvider();
    const modelName =
      this.config.model || this.modelConfig.getProvider(provider)?.defaultModel;

    if (!modelName) {
      throw new Error(`No model specified for agent ${this.config.name}`);
    }

    // Recuperar histórico se houver contexto
    let messages: ModelMessage[] = [];
    if (context) {
      messages = await this.memory.getMessages(context);
    }

    // Adicionar system prompt se houver
    if (this.config.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: this.config.systemPrompt,
      } as ModelMessage);
    }

    // Adicionar prompt atual
    if (typeof prompt === 'string') {
      messages.push({
        role: 'user',
        content: prompt,
      } as ModelMessage);
    } else {
      messages.push(...prompt);
    }

    // Stream usando Observable convertido para AsyncIterable
    const stream$ = await this.streamService.streamText(messages, {
      provider,
      model: modelName,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    let fullText = '';
    let finalMessages: ModelMessage[] = messages;
    let finalUsage: any;
    let finalToolCalls: any;

    // Converter Observable para AsyncIterable usando buffer
    const eventBuffer: any[] = [];
    let streamComplete = false;
    let streamError: Error | null = null;

    const subscription = stream$.subscribe({
      next: (event) => {
        eventBuffer.push(event);
      },
      error: (error) => {
        streamError = error;
        streamComplete = true;
      },
      complete: () => {
        streamComplete = true;
      },
    });

    // Processar eventos do buffer
    while (!streamComplete || eventBuffer.length > 0) {
      if (eventBuffer.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }

      const event = eventBuffer.shift();

      if (event.type === 'text') {
        fullText = event.data.fullText;
        yield {
          text: fullText,
          messages: finalMessages,
        };
      } else if (event.type === 'finish') {
        finalUsage = event.data.usage;
        finalToolCalls = event.data.toolCalls;
        // Converter usage se disponível
        const usage = finalUsage
          ? {
              promptTokens: finalUsage.promptTokens || 0,
              completionTokens: finalUsage.completionTokens || 0,
              totalTokens: finalUsage.totalTokens || 0,
            }
          : undefined;

        yield {
          text: fullText,
          messages: finalMessages,
          usage,
        };
      } else if (event.type === 'error') {
        throw new Error(event.data.error);
      }
    }

    subscription.unsubscribe();

    if (streamError) {
      throw streamError;
    }

    // Salvar na memória se houver contexto
    if (context) {
      await this.memory.addMessage(context, {
        role: 'user',
        content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
      });
      await this.memory.addMessage(context, {
        role: 'assistant',
        content: fullText,
      });
    }
  }
}
