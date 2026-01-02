import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { AgentConfigService } from '../config/agent-config.service';
import { ModelConfigService } from './model-config.service';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  LLMRequest,
  LLMResponse,
  StreamingEvent,
  LLMMessage,
} from './llm.types';

@Injectable()
export class OpenAIService {
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(
    private readonly configService: AgentConfigService,
    private readonly modelConfig: ModelConfigService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Executa uma chamada não-streaming para o OpenAI
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    if (!this.configService.isConfigured()) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const modelToUse = request.model || this.configService.getDefaultModel();
    const modelInfo = this.modelConfig.getModelInfo(modelToUse);
    
    if (!modelInfo) {
      throw new Error(`Modelo ${modelToUse} não encontrado ou não suportado`);
    }

    const apiKey = this.configService.getApiKey();
    const modelConfig = this.configService.getModelConfig(modelToUse);

    try {
      // GPT-5 models require max_completion_tokens instead of max_tokens
      // GPT-5 models also don't support custom temperature (only default value 1)
      const isGPT5Model = modelToUse.startsWith('gpt-5');
      
      const body: any = {
        model: modelToUse,
        messages: this.formatMessages(request.messages),
      };

      // GPT-5 models não suportam temperature customizada (apenas valor padrão 1)
      // Não incluir temperature para modelos GPT-5
      if (!isGPT5Model) {
        body.temperature = request.temperature ?? 0.7;
      }

      // Usar max_completion_tokens para GPT-5, max_tokens para outros modelos
      if (isGPT5Model) {
        body.max_completion_tokens = request.max_tokens ?? modelConfig.maxTokens;
        
        // Habilitar reasoning_effort para modelos GPT-5
        // Baseado na documentação oficial: reasoning_effort PODE ser usado junto com tools
        // Com 'minimal', o modelo pode usar function calls mais prontamente para acelerar respostas
        // gpt-5-nano suporta apenas 'minimal'
        if (request.reasoning_effort) {
          body.reasoning_effort = request.reasoning_effort;
        } else if (modelToUse === 'gpt-5-nano') {
          // Para gpt-5-nano, usar 'minimal' (único suportado)
          // Pode ser usado junto com tools - com minimal, o modelo usa tools mais prontamente
          body.reasoning_effort = 'minimal';
        }
      } else {
        body.max_tokens = request.max_tokens ?? modelConfig.maxTokens;
      }

      // Só incluir tools e tool_choice se tools estiver presente
      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools;
        body.tool_choice = request.tool_choice ?? 'auto';
      }

      if (request.response_format) {
        body.response_format = request.response_format;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(`OpenAI API error: ${error.error?.message || error.message || response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message?.content || '',
        tool_calls: choice.message?.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        finish_reason: choice.finish_reason,
        usage: data.usage,
        model: data.model,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao chamar OpenAI API: ${error.message}`, 'OpenAIService');
      throw error;
    }
  }

  /**
   * Executa uma chamada streaming para o OpenAI
   */
  streamChat(request: LLMRequest): Observable<StreamingEvent> {
    if (!this.configService.isConfigured()) {
      return new Observable((observer) => {
        observer.error(new Error('OPENAI_API_KEY não configurada'));
      });
    }

    const modelToUse = request.model || this.configService.getDefaultModel();
    const modelInfo = this.modelConfig.getModelInfo(modelToUse);
    
    if (!modelInfo) {
      return new Observable((observer) => {
        observer.error(new Error(`Modelo ${modelToUse} não encontrado ou não suportado`));
      });
    }

    if (!modelInfo.supportsStreaming) {
      return new Observable((observer) => {
        observer.error(new Error(`Modelo ${modelToUse} não suporta streaming`));
      });
    }

    const apiKey = this.configService.getApiKey();
    const modelConfig = this.configService.getModelConfig(modelToUse);
    const subject = new Subject<StreamingEvent>();

    // Executar streaming de forma assíncrona
    this.executeStreaming(request, apiKey, modelToUse, modelConfig, subject).catch((error) => {
      subject.error(error);
    });

    return subject.asObservable();
  }

  private async executeStreaming(
    request: LLMRequest,
    apiKey: string,
    model: string,
    modelConfig: { maxTokens: number; temperature: number },
    subject: Subject<StreamingEvent>,
  ): Promise<void> {
    try {
      // GPT-5 models require max_completion_tokens instead of max_tokens
      // GPT-5 models also don't support custom temperature (only default value 1)
      const isGPT5Model = model.startsWith('gpt-5');
      
      const body: any = {
        model,
        messages: this.formatMessages(request.messages),
        stream: true,
      };

      // GPT-5 models não suportam temperature customizada (apenas valor padrão 1)
      // Não incluir temperature para modelos GPT-5
      if (!isGPT5Model) {
        body.temperature = request.temperature ?? 0.7;
      }

      // Usar max_completion_tokens para GPT-5, max_tokens para outros modelos
      if (isGPT5Model) {
        body.max_completion_tokens = request.max_tokens ?? modelConfig.maxTokens;
        
        // Habilitar reasoning_effort para modelos GPT-5
        // Baseado na documentação oficial: reasoning_effort PODE ser usado junto com tools
        // Com 'minimal', o modelo pode usar function calls mais prontamente para acelerar respostas
        // gpt-5-nano suporta apenas 'minimal'
        if (request.reasoning_effort) {
          // Se foi explicitamente solicitado, usar
          body.reasoning_effort = request.reasoning_effort;
        } else if (model === 'gpt-5-nano') {
          // Para gpt-5-nano, usar 'minimal' (único suportado)
          // Pode ser usado junto com tools - com minimal, o modelo usa tools mais prontamente
          body.reasoning_effort = 'minimal';
        }
      } else {
        body.max_tokens = request.max_tokens ?? modelConfig.maxTokens;
      }

      // Só incluir tools e tool_choice se tools estiver presente
      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools;
        body.tool_choice = request.tool_choice ?? 'auto';
      }

      if (request.response_format) {
        body.response_format = request.response_format;
      }

      // Log do body sendo enviado (sem a API key, apenas estrutura)
      const bodyForLog = { ...body };
      if (bodyForLog.messages) {
        bodyForLog.messages = bodyForLog.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content ? `${msg.content.substring(0, 100)}...` : null,
          hasToolCalls: !!msg.tool_calls,
          toolCallsCount: msg.tool_calls?.length || 0,
          toolCallId: msg.tool_call_id || null,
        }));
      }
      console.log('[OpenAIService] Enviando requisição para OpenAI (streaming):', JSON.stringify({
        ...bodyForLog,
        toolsCount: body.tools?.length || 0,
        hasToolChoice: !!body.tool_choice,
        toolChoice: body.tool_choice,
      }, null, 2));

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        console.error('[OpenAIService] Erro na resposta (streaming):', error);
        throw new Error(`OpenAI API error: ${error.error?.message || error.message || response.statusText}`);
      }
      
      console.log('[OpenAIService] Resposta recebida (streaming), status:', response.status, response.statusText);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolCall: any = null;
      let toolCallsMap: Map<number, any> = new Map(); // Mapa de índices para tool calls
      let usage: any = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Emitir evento de conclusão
          if (usage) {
            subject.next({
              type: 'usage',
              data: usage,
              timestamp: Date.now(),
            });
          }
          subject.next({
            type: 'done',
            data: { finish_reason: 'stop' },
            timestamp: Date.now(),
          });
          subject.complete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];
              
              if (!choice) continue;

              // Processar delta de conteúdo (resposta final)
              if (choice.delta?.content) {
                subject.next({
                  type: 'token',
                  data: {
                    content: choice.delta.content,
                    delta: choice.delta.content,
                  },
                  timestamp: Date.now(),
                });
              }
              
              // Processar pensamentos/reasoning (GPT-5 models)
              // O reasoning pode vir em diferentes formatos:
              // 1. choice.delta.reasoning (streaming incremental)
              // 2. choice.reasoning (completo)
              // 3. parsed.reasoning (no nível da resposta)
              if (choice.delta?.reasoning) {
                // Reasoning incremental no delta
                subject.next({
                  type: 'thinking',
                  data: {
                    content: choice.delta.reasoning,
                    delta: choice.delta.reasoning,
                  },
                  timestamp: Date.now(),
                });
              } else if (choice.reasoning) {
                // Reasoning completo no choice
                subject.next({
                  type: 'thinking',
                  data: {
                    content: choice.reasoning,
                    delta: choice.reasoning,
                  },
                  timestamp: Date.now(),
                });
              } else if (parsed.reasoning) {
                // Reasoning no nível da resposta
                subject.next({
                  type: 'thinking',
                  data: {
                    content: parsed.reasoning,
                    delta: parsed.reasoning,
                  },
                  timestamp: Date.now(),
                });
              } else if (choice.delta && Object.keys(choice.delta).length > 0 && !choice.delta.tool_calls) {
                // Log para debug: ver o que está vindo no delta se não for content nem tool_calls
                // Mas não logar se for apenas role ou outros campos comuns
                const ignoredFields = ['role', 'refusal'];
                const hasOtherFields = Object.keys(choice.delta).some(key => !ignoredFields.includes(key));
                if (hasOtherFields) {
                  console.log('[OpenAIService] Delta recebido sem content:', JSON.stringify(choice.delta));
                }
              }

              // Processar tool calls
              if (choice.delta?.tool_calls) {
                for (const toolCallDelta of choice.delta.tool_calls) {
                  const index = toolCallDelta.index ?? 0;
                  
                  // Buscar ou criar tool call para este índice
                  if (!toolCallsMap.has(index) && toolCallDelta.id) {
                    // Novo tool call - criar novo objeto
                    toolCallsMap.set(index, {
                      id: toolCallDelta.id,
                      type: 'function',
                      function: {
                        name: '',
                        arguments: '',
                      },
                    });
                  }

                  const toolCall = toolCallsMap.get(index);
                  if (toolCall) {
                    if (toolCallDelta.function?.name) {
                      toolCall.function.name += toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function?.arguments) {
                      toolCall.function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                }
              }

              // Se o tool call estiver completo (finish_reason indica que terminou)
              if (choice.finish_reason === 'tool_calls') {
                // Emitir todos os tool calls completos
                for (const [index, toolCall] of toolCallsMap.entries()) {
                  subject.next({
                    type: 'tool_call',
                    data: {
                      id: toolCall.id,
                      name: toolCall.function.name,
                      arguments: toolCall.function.arguments || '{}',
                    },
                    timestamp: Date.now(),
                  });
                }
                toolCallsMap.clear();
                currentToolCall = null;
              }

              // Capturar finish_reason para debug
              if (choice.finish_reason) {
                console.log(`[OpenAIService] Finish reason: ${choice.finish_reason}`);
              }

              // Capturar usage
              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch (error) {
              // Ignorar erros de parsing de linhas individuais
              this.logger.warn(`Erro ao processar chunk: ${error}`, 'OpenAIService');
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Erro no streaming OpenAI: ${error.message}`, 'OpenAIService');
      subject.error(error);
    }
  }

  /**
   * Formata mensagens para o formato da API OpenAI
   */
  private formatMessages(messages: LLMMessage[]): any[] {
    return messages.map((msg) => {
      const formatted: any = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        formatted.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      if (msg.tool_call_id) {
        formatted.tool_call_id = msg.tool_call_id;
      }

      if (msg.name) {
        formatted.name = msg.name;
      }

      return formatted;
    });
  }
}
