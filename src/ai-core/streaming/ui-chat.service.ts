import { Injectable, Logger } from '@nestjs/common';
import {
  streamText,
  convertToModelMessages,
  pipeUIMessageStreamToResponse,
  type UIMessage,
} from 'ai';
import { ModelProviderFactory } from '../providers/model-provider.factory';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { AiCoreConfigService } from '../config/ai-core.config';
import { LanguageModel } from 'ai';
import type { Response } from 'express';

export interface UIChatOptions {
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  temperature?: number;
  maxTokens?: number;
  sendReasoning?: boolean;
  tools?: Record<string, any>;
  providerOptions?: Record<string, any>;
  abortSignal?: AbortSignal;
  maxRetries?: number;
}

@Injectable()
export class UIChatService {
  private readonly logger = new Logger(UIChatService.name);

  constructor(
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
  ) {}

  /**
   * Stream chat messages using AI SDK UI protocol (compatible with useChat)
   * Pipes the stream directly to Express response
   */
  async streamChat(
    messages: UIMessage[],
    res: Response,
    options: UIChatOptions = {},
  ): Promise<void> {
    const provider = options.provider || this.aiConfig.getDefaultProvider();
    const modelName = options.model || this.modelConfig.getProvider(provider)?.defaultModel;

    if (!modelName) {
      throw new Error(`No model specified for provider ${provider}`);
    }

    const model = this.providerFactory.getModel(provider, modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not available for provider ${provider}`);
    }

    const modelConfig = this.modelConfig.getModel(modelName);
    const isGpt5 = modelName.includes('gpt-5');

    // Convert UIMessages to ModelMessages
    const modelMessages = await convertToModelMessages(messages);

    // Build stream options with timeout and retries
    const timeout = this.aiConfig.getTimeout();
    const abortController = options.abortSignal
      ? undefined
      : new AbortController();
    const timeoutId = options.abortSignal
      ? undefined
      : setTimeout(() => {
          abortController?.abort();
          this.logger.warn(`Stream timeout after ${timeout}ms`);
        }, timeout);

    const streamOptions: any = {
      model,
      messages: modelMessages,
      maxOutputTokens: options.maxTokens ?? modelConfig?.maxTokens,
      maxRetries: options.maxRetries ?? this.aiConfig.getMaxRetries(),
      abortSignal: options.abortSignal || abortController?.signal,
    };

    // Configure provider-specific options
    if (!streamOptions.providerOptions) {
      streamOptions.providerOptions = {};
    }

    // GPT-5 doesn't support temperature, topP, etc.
    if (!isGpt5) {
      if (options.temperature !== undefined || modelConfig?.temperature !== undefined) {
        streamOptions.temperature = options.temperature ?? modelConfig?.temperature ?? 0.7;
      }
    }

    // Add tools if provided
    if (options.tools) {
      streamOptions.tools = options.tools;
    }

    // Configure reasoning support per provider
    if (options.sendReasoning) {
      if (provider === 'anthropic' && modelName.includes('claude')) {
        // Check if model supports thinking (Claude 3.7+, Claude 4)
        const supportsThinking =
          modelName.includes('claude-3-7') ||
          modelName.includes('claude-4') ||
          modelName.includes('claude-sonnet-4');

        if (supportsThinking) {
          if (!streamOptions.providerOptions.anthropic) {
            streamOptions.providerOptions.anthropic = {};
          }
          streamOptions.providerOptions.anthropic.thinking = {
            type: 'enabled',
            budgetTokens: 15000,
          };
          // Add beta header for interleaved thinking if needed
          if (!streamOptions.headers) {
            streamOptions.headers = {};
          }
          streamOptions.headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
          this.logger.debug(`Enabled reasoning for ${modelName}`);
        }
      } else if (provider === 'openai') {
        // OpenAI reasoning (GPT-5, o1, o3-mini)
        if (modelName.includes('gpt-5') || modelName.includes('o1') || modelName.includes('o3-mini')) {
          if (!streamOptions.providerOptions.openai) {
            streamOptions.providerOptions.openai = {};
          }
          // GPT-5 supports reasoningEffort and reasoningSummary
          if (modelName.includes('gpt-5')) {
            streamOptions.providerOptions.openai.reasoningEffort = 'high';
            streamOptions.providerOptions.openai.reasoningSummary = 'detailed';
          }
          this.logger.debug(`Enabled reasoning for ${modelName}`);
        }
      }
    }

    // Merge custom provider options (after reasoning config)
    if (options.providerOptions) {
      streamOptions.providerOptions = {
        ...streamOptions.providerOptions,
        ...options.providerOptions,
      };
    }

    this.logger.debug(
      `Streaming chat with model ${modelName} (provider: ${provider}, messages: ${messages.length})`,
    );

    try {
      const result = streamText(streamOptions);

      // Clear timeout if stream starts successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Pipe UI Message stream to Express response (compatible with useChat)
      // Note: pipeUIMessageStreamToResponse handles the stream asynchronously
      pipeUIMessageStreamToResponse({
        response: res,
        stream: result.toUIMessageStream({
          sendReasoning: options.sendReasoning ?? false,
        }),
      });

      // The stream will be handled by pipeUIMessageStreamToResponse
      // We don't need to await it as it pipes directly to the response
    } catch (error: any) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.logger.error(`Error streaming chat: ${error.message}`, error.stack);
      throw error;
    }
  }

}
