import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { OpenAIService } from './openai.service';
import { ModelConfigService } from './model-config.service';
import { AgentConfigService } from '../config/agent-config.service';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  LLMRequest,
  LLMResponse,
  StreamingEvent,
  LLMMessage,
  StructuredOutput,
  LLMTool,
} from './llm.types';

@Injectable()
export class LLMService {
  constructor(
    private readonly openaiService: OpenAIService,
    private readonly modelConfig: ModelConfigService,
    private readonly configService: AgentConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Executa uma chamada não-streaming
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      return await this.openaiService.chat(request);
    } catch (error: any) {
      this.logger.error(
        `Erro no LLMService.chat: ${error.message}`,
        'LLMService',
      );
      throw error;
    }
  }

  /**
   * Executa uma chamada streaming
   */
  streamChat(request: LLMRequest): Observable<StreamingEvent> {
    try {
      return this.openaiService.streamChat(request);
    } catch (error: any) {
      this.logger.error(
        `Erro no LLMService.streamChat: ${error.message}`,
        'LLMService',
      );
      return new Observable((observer) => {
        observer.error(error);
      });
    }
  }

  /**
   * Cria uma requisição com tools
   */
  withTools(request: LLMRequest, tools: LLMTool[]): LLMRequest {
    const model = request.model || this.configService.getDefaultModel();
    const modelInfo = this.modelConfig.getModelInfo(model);

    if (!modelInfo?.supportsFunctions) {
      this.logger.warn(
        `Modelo ${model} não suporta function calling`,
        'LLMService',
      );
      return request;
    }

    return {
      ...request,
      tools: [...(request.tools || []), ...tools],
      tool_choice: request.tool_choice ?? 'auto',
    };
  }

  /**
   * Cria uma requisição com structured output
   */
  withStructuredOutput(
    request: LLMRequest,
    output: StructuredOutput,
  ): LLMRequest {
    const model = request.model || this.configService.getDefaultModel();
    const modelInfo = this.modelConfig.getModelInfo(model);

    if (!modelInfo?.supportsStructuredOutputs) {
      this.logger.warn(
        `Modelo ${model} não suporta structured outputs`,
        'LLMService',
      );
      return request;
    }

    return {
      ...request,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: output.name || 'response',
          strict: output.strict ?? true,
          schema: output.schema,
        },
      },
    };
  }

  /**
   * Cria mensagem do sistema
   */
  createSystemMessage(content: string): LLMMessage {
    return {
      role: 'system',
      content,
    };
  }

  /**
   * Cria mensagem do usuário
   */
  createUserMessage(content: string): LLMMessage {
    return {
      role: 'user',
      content,
    };
  }

  /**
   * Cria mensagem do assistente
   */
  createAssistantMessage(content: string): LLMMessage {
    return {
      role: 'assistant',
      content,
    };
  }

  /**
   * Cria mensagem de tool result
   */
  createToolMessage(
    toolCallId: string,
    content: string,
    name?: string,
  ): LLMMessage {
    return {
      role: 'tool',
      content,
      tool_call_id: toolCallId,
      name,
    };
  }
}
