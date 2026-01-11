import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { AgentRunnerService } from '../runner/agent-runner.service';
import { StreamRunnerService } from '../runner/stream-runner.service';
import { ContextProvider } from '../context/context.provider';
import { AgentRegistry } from '../agent/agent.registry';
import { ManagerAgentService } from '../../agentes/manager/manager-agent.service';
import { KnowledgeBaseAgentService } from '../../agentes/knowledge-base/knowledge-base-agent.service';
import {
  MultiAgentDemoResult,
  ReasoningStep,
  ToolCallDetail,
  DelegationDetail,
  MessageItem,
  ExecutionMetadata,
} from './dto/core-demo.dto';
import { RunResult, StreamedRunResult } from '@openai/agents';

/**
 * Serviço para demonstrar multi-agente com tracing completo
 */
@Injectable()
export class CoreDemoService {
  private readonly logger = new Logger(CoreDemoService.name);

  constructor(
    private readonly runnerService: AgentRunnerService,
    private readonly streamRunnerService: StreamRunnerService,
    private readonly contextProvider: ContextProvider,
    private readonly agentRegistry: AgentRegistry,
    private readonly managerAgentService: ManagerAgentService,
    private readonly knowledgeBaseAgentService: KnowledgeBaseAgentService,
  ) {}

  /**
   * Executa o demo multi-agente e extrai todos os detalhes
   */
  async runMultiAgentDemo(
    query: string,
    tenantId: string,
    userId: string,
    schoolId?: string,
  ): Promise<MultiAgentDemoResult> {
    const startTime = Date.now();

    try {
      // 1. Criar contexto
      const context = this.contextProvider.getContext(tenantId, userId, {
        schoolId,
      });

      // 2. Criar KnowledgeBaseAgent
      this.logger.log('Criando KnowledgeBaseAgent...');
      const kbAgent = await this.knowledgeBaseAgentService.create(context);

      // 3. Registrar no registry (para Manager descobrir)
      // Nota: O AgentFactory já registra automaticamente, mas garantimos aqui
      this.agentRegistry.register(kbAgent);
      this.logger.log('KnowledgeBaseAgent registrado no AgentRegistry');

      // 4. Criar ManagerAgent (descobrirá KB agent automaticamente)
      this.logger.log('Criando ManagerAgent com descoberta dinâmica...');
      const managerAgent = await this.managerAgentService.create(context);

      // 5. Executar ManagerAgent
      this.logger.log(`Executando demo multi-agente com query: ${query}`);
      const result = await this.runnerService.run(managerAgent, query, {
        context,
      });

      // Debug: Log da estrutura do resultado
      this.logger.log('=== RunResult Debug ===');
      this.logger.log(`newItems: ${result.newItems?.length || 0}`);
      this.logger.log(`history: ${result.history?.length || 0}`);
      
      // Log detalhado do histórico
      if (result.history) {
        this.logger.log('Histórico completo:');
        result.history.forEach((msg: any, idx: number) => {
          this.logger.log(`[${idx}] role: ${msg.role}, hasToolCalls: ${!!msg.tool_calls}, toolCallsCount: ${msg.tool_calls?.length || 0}`);
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            msg.tool_calls.forEach((tc: any, tcIdx: number) => {
              this.logger.log(`  ToolCall[${tcIdx}]: ${tc.function?.name || tc.name}, id: ${tc.id}`);
            });
          }
        });
      }
      
      // Log detalhado de newItems
      if (result.newItems) {
        this.logger.log('NewItems:');
        result.newItems.forEach((item: any, idx: number) => {
          const itemType = (item as any).type || (item as any).constructor?.name || 'unknown';
          this.logger.log(`[${idx}] type: ${itemType}, hasRawItem: ${!!(item as any).rawItem}`);
        });
      }

      // 8. Extrair informações detalhadas do resultado
      const executionDetails = this.extractExecutionDetails(result);

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        query,
        finalAnswer: result.finalOutput || 'Sem resposta',
        execution: executionDetails,
        metadata: {
          totalAgents: this.agentRegistry.count(), // Total de agentes registrados
          totalToolCalls: executionDetails.toolCalls.length,
          totalDelegations: executionDetails.delegations.length,
          executionTime,
          model: 'gpt-5-mini',
        },
      };
    } catch (error: any) {
      this.logger.error(`Erro no demo multi-agente: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Executa o demo multi-agente com streaming
   */
  streamMultiAgentDemo(
    query: string,
    tenantId: string,
    userId: string,
    schoolId?: string,
  ): Observable<any> {
    const subject = new Subject<any>();

    (async () => {
      try {
        // 1. Criar contexto
        const context = this.contextProvider.getContext(tenantId, userId, {
          schoolId,
        });

        // 2. Criar KnowledgeBaseAgent
        this.logger.log('Criando KnowledgeBaseAgent para streaming...');
        const kbAgent = await this.knowledgeBaseAgentService.create(context);

        // 3. Registrar no registry
        this.agentRegistry.register(kbAgent);
        this.logger.log('KnowledgeBaseAgent registrado no AgentRegistry');

        // 4. Criar ManagerAgent
        this.logger.log('Criando ManagerAgent com descoberta dinâmica...');
        const managerAgent = await this.managerAgentService.create(context);

        // 5. Executar ManagerAgent com streaming
        this.logger.log(`Executando demo multi-agente com streaming: ${query}`);
        
        const stream = this.streamRunnerService.stream(managerAgent, query, {
          context,
        });

        let accumulatedContent = '';

        for await (const event of stream) {
          // Formatar evento do stream (seguindo padrão do Knowledge Base)
          const formattedEvent = this.formatStreamEvent(event);
          if (formattedEvent) {
            // Acumular conteúdo para tokens
            if (formattedEvent.type === 'token') {
              accumulatedContent += formattedEvent.data.content || formattedEvent.data.delta || '';
            }

            subject.next({
              type: formattedEvent.type,
              data: formattedEvent.data,
              timestamp: Date.now(),
            });
          }
        }

        // Enviar evento de conclusão com resposta final (seguindo padrão do Knowledge Base)
        subject.next({
          type: 'done',
          data: {
            answer: accumulatedContent || 'Não foi possível gerar uma resposta.',
          },
          timestamp: Date.now(),
        });

        subject.complete();
      } catch (error: any) {
        this.logger.error(
          `Erro no demo multi-agente com streaming: ${error.message}`,
          error.stack,
        );
        subject.error(error);
      }
    })();

    return subject.asObservable();
  }

  /**
   * Formata evento do stream para o formato esperado (compatível com frontend)
   * Baseado na documentação: https://openai.github.io/openai-agents-js/guides/streaming/
   */
  private formatStreamEvent(event: any): { type: string; data: any } | null {
    // 1. raw_model_stream_event - eventos diretos do modelo
    if (event.type === 'raw_model_stream_event' && event.data) {
      const data = event.data;
      
      // Reasoning do modelo
      if (data.type === 'reasoning' || data.type === 'reasoning_delta') {
        return {
          type: 'thinking',
          data: {
            reasoning: data.content || data.delta || data.text || '',
            delta: data.delta || '',
          },
        };
      }
      
      // Texto do modelo (output_text_delta)
      if (data.type === 'output_text_delta' || data.type === 'text_delta') {
        return {
          type: 'token',
          data: {
            content: data.delta || data.content || '',
            delta: data.delta || data.content || '',
          },
        };
      }
      
      // Texto completo (output_text)
      if (data.type === 'output_text' || data.type === 'text') {
        return {
          type: 'token',
          data: {
            content: data.content || data.text || '',
            delta: data.content || data.text || '',
          },
        };
      }
    }

    // 2. run_item_stream_event - eventos de itens de execução
    if (event.type === 'run_item_stream_event' && event.item) {
      const item = event.item;
      
      // Reasoning item
      if (item.type === 'reasoning' || item.type === 'reasoning_item') {
        const reasoningText = this.extractReasoningText(item);
        return {
          type: 'thinking',
          data: {
            reasoning: reasoningText,
          },
        };
      }
      
      // Tool call
      if (item.type === 'tool_call' || item.type === 'function') {
        return {
          type: 'tool_call',
          data: {
            toolCalls: [item],
          },
        };
      }
      
      // Tool result
      if (item.type === 'tool_call_output' || item.type === 'tool') {
        return {
          type: 'tool_result',
          data: {
            toolResults: [item],
          },
        };
      }
      
      // Message output (texto)
      if (item.type === 'message_output' || item.type === 'message') {
        const content = this.extractMessageContent(item.content);
        if (content) {
          return {
            type: 'token',
            data: {
              content: content,
              delta: content,
            },
          };
        }
      }
    }

    // 3. agent_updated_stream_event - mudança de agente
    if (event.type === 'agent_updated_stream_event') {
      return {
        type: 'agent_updated',
        data: {
          agent: event.agent?.name || 'Unknown',
        },
      };
    }

    // 4. Eventos diretos (compatibilidade com versões anteriores)
    if (event.type === 'content' || event.type === 'text') {
      return {
        type: 'token',
        data: {
          content: event.content || event.text || event.delta || '',
          delta: event.delta || event.content || event.text || '',
        },
      };
    }

    if (event.type === 'tool_call' || event.toolCalls) {
      return {
        type: 'tool_call',
        data: {
          toolCalls: event.toolCalls || [event],
        },
      };
    }

    if (event.type === 'tool_result' || event.toolResults) {
      return {
        type: 'tool_result',
        data: {
          toolResults: event.toolResults || [event],
        },
      };
    }

    if (event.type === 'thinking' || event.reasoning) {
      return {
        type: 'thinking',
        data: {
          reasoning: event.reasoning || event.thinking || event.content,
        },
      };
    }

    // 5. Eventos com content/delta direto
    if (event.content && typeof event.content === 'string') {
      return {
        type: 'token',
        data: {
          content: event.content,
          delta: event.delta || event.content,
        },
      };
    }

    if (event.delta && typeof event.delta === 'string') {
      return {
        type: 'token',
        data: {
          content: event.delta,
          delta: event.delta,
        },
      };
    }

    // 6. newItems (formato legado)
    if (event.newItems && Array.isArray(event.newItems)) {
      for (const item of event.newItems) {
        if (item.type === 'content' || item.type === 'text') {
          return {
            type: 'token',
            data: {
              content: item.content || item.text || '',
              delta: item.delta || item.content || item.text || '',
            },
          };
        }
        if (item.type === 'tool_call') {
          return {
            type: 'tool_call',
            data: {
              toolCalls: [item],
            },
          };
        }
        if (item.type === 'reasoning' || item.type === 'reasoning_item') {
          const reasoningText = this.extractReasoningText(item);
          return {
            type: 'thinking',
            data: {
              reasoning: reasoningText,
            },
          };
        }
      }
    }

    // Ignorar eventos desconhecidos (log para debug)
    this.logger.debug(`Evento de stream não mapeado: ${JSON.stringify(event)}`);
    return null;
  }

  /**
   * Extrai texto de reasoning de um item
   */
  private extractReasoningText(item: any): string {
    if (item.content) {
      if (typeof item.content === 'string') {
        return item.content;
      }
      if (Array.isArray(item.content)) {
        return item.content
          .map((entry: any) => {
            if (entry.type === 'input_text' && entry.text) {
              return entry.text;
            }
            if (entry.text) {
              return entry.text;
            }
            if (entry.content) {
              return this.extractReasoningText(entry);
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
      }
    }
    if (item.text) {
      return item.text;
    }
    if (item.delta) {
      return item.delta;
    }
    return '';
  }

  /**
   * Extrai informações detalhadas do RunResult
   */
  private extractExecutionDetails(result: RunResult<any, any>): {
    reasoning: ReasoningStep[];
    toolCalls: ToolCallDetail[];
    delegations: DelegationDetail[];
    history: MessageItem[];
  } {
    const reasoning: ReasoningStep[] = [];
    const toolCalls: ToolCallDetail[] = [];
    const delegations: DelegationDetail[] = [];
    const history: MessageItem[] = [];

    let reasoningStep = 0;
    const toolCallMap = new Map<string, ToolCallDetail>();

    this.logger.log(`Extraindo detalhes de execução. newItems: ${result.newItems?.length || 0}, history: ${result.history?.length || 0}`);

    // Processar newItems para extrair reasoning, tool calls e handoffs
    if (result.newItems) {
      for (const item of result.newItems) {
        // Verificar tipo do item de múltiplas formas
        const itemType = 
          (item as any).type || 
          (item as any).constructor?.name ||
          (item as any).rawItem?.type ||
          (item as any).rawItem?.constructor?.name ||
          'unknown';
        
        this.logger.debug(`Processando item tipo: ${itemType}`, JSON.stringify(item, null, 2));

        // Reasoning items
        if (
          itemType === 'reasoning_item' ||
          (item as any).rawItem?.type === 'reasoning' ||
          (item as any).type === 'reasoning'
        ) {
          reasoningStep++;
          const rawItem = (item as any).rawItem || item;
          const thought = this.extractThoughtFromReasoning(rawItem);
          const agentName = (item as any).agent?.name || 'Unknown';
          reasoning.push({
            step: reasoningStep,
            agent: agentName,
            thought: thought || 'Reasoning step',
            timestamp: Date.now(),
          });
        }

        // Tool calls
        if (
          itemType === 'tool_call' ||
          (item as any).rawItem?.type === 'function' ||
          (item as any).type === 'function' ||
          (item as any).rawItem?.function
        ) {
          const rawItem = (item as any).rawItem || item;
          const toolCall: ToolCallDetail = {
            id: rawItem.id || `tool-${Date.now()}-${Math.random()}`,
            agent: (item as any).agent?.name || 'Unknown',
            toolName:
              rawItem.function?.name ||
              rawItem.name ||
              (item as any).toolName ||
              'unknown',
            arguments: this.parseToolArguments(rawItem),
            result: null,
            timestamp: Date.now(),
            success: false,
          };
          toolCallMap.set(toolCall.id, toolCall);
        }

        // Tool call outputs
        if (
          itemType === 'tool_call_output' ||
          (item as any).rawItem?.role === 'tool' ||
          (item as any).role === 'tool' ||
          (item as any).type === 'tool'
        ) {
          const rawItem = (item as any).rawItem || item;
          const toolCallId =
            rawItem.tool_call_id ||
            rawItem.id ||
            (item as any).toolCallId;
          const existingCall = toolCallId
            ? toolCallMap.get(toolCallId)
            : null;

          if (existingCall) {
            existingCall.result = this.parseToolResult(rawItem);
            existingCall.success = true;
          } else if (toolCallId) {
            // Criar novo se não encontrado
            toolCalls.push({
              id: toolCallId,
              agent: (item as any).agent?.name || 'Unknown',
              toolName: rawItem.name || 'unknown',
              arguments: {},
              result: this.parseToolResult(rawItem),
              timestamp: Date.now(),
              success: true,
            });
          }
        }

        // Handoff calls
        if (
          itemType === 'handoff_call' ||
          (item as any).type === 'handoff' ||
          (item as any).rawItem?.type === 'handoff'
        ) {
          const rawItem = (item as any).rawItem || item;
          const sourceAgent = (item as any).sourceAgent?.name || 'Unknown';
          const targetAgent =
            (item as any).targetAgent?.name ||
            rawItem.name ||
            rawItem.function?.name ||
            'Unknown';
          delegations.push({
            from: sourceAgent,
            to: targetAgent,
            reason: rawItem.function?.arguments
              ? JSON.parse(rawItem.function.arguments || '{}').reason ||
                'Delegation'
              : rawItem.content || 'Delegation',
            timestamp: Date.now(),
          });
        }

        // Handoff outputs
        if (
          itemType === 'handoff_output' ||
          (item as any).type === 'handoff_output'
        ) {
          const rawItem = (item as any).rawItem || item;
          if (delegations.length > 0) {
            const lastDelegation = delegations[delegations.length - 1];
            lastDelegation.reason = rawItem.content || lastDelegation.reason;
          }
        }

        // Messages
        if (
          itemType === 'message_output' ||
          (item as any).rawItem?.role ||
          (item as any).role ||
          (item as any).type === 'message'
        ) {
          const rawItem = (item as any).rawItem || item;
          const content = this.extractMessageContent(rawItem.content);
          
          // Extrair tool calls das mensagens assistant
          if (rawItem.tool_calls && Array.isArray(rawItem.tool_calls)) {
            for (const toolCall of rawItem.tool_calls) {
              const toolCallId = toolCall.id || `tool-${Date.now()}-${Math.random()}`;
              const toolCallDetail: ToolCallDetail = {
                id: toolCallId,
                agent: (item as any).agent?.name || 'ManagerAgent',
                toolName: toolCall.function?.name || toolCall.name || 'unknown',
                arguments: this.parseToolArguments(toolCall),
                result: null,
                timestamp: Date.now(),
                success: false,
              };
              
              // Verificar se é uma delegação (agent as tool)
              const toolName = toolCall.function?.name || toolCall.name || '';
              if (toolName.includes('agent') || toolName.includes('Agent')) {
                // Extrair nome do agente (ex: calculatoragent_agent -> CalculatorAgent)
                let agentName = toolName
                  .replace(/_agent$/, '')
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (l: string) => l.toUpperCase());
                
                // Melhorar formatação
                if (agentName.toLowerCase().includes('calculator')) {
                  agentName = 'CalculatorAgent';
                } else if (agentName.toLowerCase().includes('search')) {
                  agentName = 'SearchAgent';
                }
                
                const toolArgs = this.parseToolArguments(toolCall);
                delegations.push({
                  from: 'ManagerAgent',
                  to: agentName,
                  reason: toolArgs.input || toolArgs.query || toolArgs.expression || 'Delegation',
                  timestamp: Date.now(),
                });
              }
              
              toolCallMap.set(toolCallId, toolCallDetail);
            }
          }
          
          history.push({
            role: rawItem.role || 'assistant',
            content: content,
            toolCalls: rawItem.tool_calls,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Tool calls já foram adicionados ao map durante o processamento

    // Processar histórico se disponível - PRIMEIRO PASSO: extrair tool calls
    if (result.history) {
      for (const msg of result.history) {
        if (typeof msg === 'object' && 'role' in msg) {
          const msgAny = msg as any;
          
          // Extrair tool calls do histórico (mensagens assistant com tool_calls)
          if (msgAny.role === 'assistant' && msgAny.tool_calls && Array.isArray(msgAny.tool_calls)) {
            this.logger.log(`Encontrado ${msgAny.tool_calls.length} tool calls na mensagem assistant`);
            
            for (const toolCall of msgAny.tool_calls) {
              const toolCallId = toolCall.id || `tool-${Date.now()}-${Math.random()}`;
              const toolName = toolCall.function?.name || toolCall.name || 'unknown';
              
              this.logger.log(`Processando tool call: ${toolName}, id: ${toolCallId}`);
              
              if (!toolCallMap.has(toolCallId)) {
                const toolCallDetail: ToolCallDetail = {
                  id: toolCallId,
                  agent: 'ManagerAgent',
                  toolName: toolName,
                  arguments: this.parseToolArguments(toolCall),
                  result: null,
                  timestamp: Date.now(),
                  success: false,
                };
                
                // Verificar se é uma delegação (agent as tool)
                if (toolName.includes('agent') || toolName.includes('Agent') || toolName.endsWith('_agent')) {
                  // Extrair nome do agente
                  let agentName = toolName
                    .replace(/_agent$/, '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase());
                  
                  // Melhorar formatação
                  if (agentName.toLowerCase().includes('calculator')) {
                    agentName = 'CalculatorAgent';
                  } else if (agentName.toLowerCase().includes('search')) {
                    agentName = 'SearchAgent';
                  }
                  
                  const toolArgs = this.parseToolArguments(toolCall);
                  const delegationReason = toolArgs.input || toolArgs.query || toolArgs.expression || 'Delegation';
                  
                  this.logger.log(`Delegação detectada: ManagerAgent -> ${agentName}, reason: ${delegationReason}`);
                  
                  delegations.push({
                    from: 'ManagerAgent',
                    to: agentName,
                    reason: delegationReason,
                    timestamp: Date.now(),
                  });
                }
                
                toolCallMap.set(toolCallId, toolCallDetail);
              }
            }
          }
        }
      }
    }
    
    // SEGUNDO PASSO: processar tool outputs e adicionar ao histórico
    if (result.history) {
      for (const msg of result.history) {
        if (typeof msg === 'object' && 'role' in msg) {
          const msgAny = msg as any;
          const content = this.extractMessageContent(msgAny.content);
          
          // Processar tool outputs (mensagens com role 'tool')
          if (msgAny.role === 'tool') {
            const toolCallId = msgAny.tool_call_id || msgAny.id;
            
            if (toolCallId && toolCallMap.has(toolCallId)) {
              const existingCall = toolCallMap.get(toolCallId);
              if (existingCall) {
                existingCall.result = this.parseToolResult(msgAny);
                existingCall.success = true;
                this.logger.log(`Tool output processado para ${existingCall.toolName}, id: ${toolCallId}`);
              }
            } else if (toolCallId) {
              // Criar tool call se não existir (pode ser resultado de agente delegado)
              const toolName = msgAny.name || 'unknown';
              const toolCallDetail: ToolCallDetail = {
                id: toolCallId,
                agent: 'ManagerAgent',
                toolName: toolName,
                arguments: {},
                result: this.parseToolResult(msgAny),
                timestamp: Date.now(),
                success: true,
              };
              
              // Verificar se é resultado de delegação
              if (toolName.includes('agent') || toolName.includes('Agent')) {
                // Atualizar delegação correspondente se existir
                const matchingDelegation = delegations.find(
                  (d) => d.to.toLowerCase().includes(toolName.toLowerCase().replace('_agent', '').replace(/_/g, ''))
                );
                if (matchingDelegation) {
                  matchingDelegation.reason = this.extractMessageContent(msgAny.content) || matchingDelegation.reason;
                }
              }
              
              toolCallMap.set(toolCallId, toolCallDetail);
            }
          }
          
          // Adicionar ao histórico (apenas uma vez)
          if (!history.find((h) => h.content === content && h.role === msgAny.role)) {
            history.push({
              role: msgAny.role,
              content: content,
              toolCalls: msgAny.tool_calls,
            });
          }
        }
      }
    }

    // Adicionar tool calls do map ao final (após processar tudo)
    const allToolCalls = [...toolCalls, ...Array.from(toolCallMap.values())];
    
    // Remover tool calls duplicados
    const uniqueToolCalls = Array.from(
      new Map(allToolCalls.map((tc) => [tc.id, tc])).values()
    );

    // Remover delegações duplicadas (baseado em from+to)
    const uniqueDelegations = Array.from(
      new Map(delegations.map((d) => [`${d.from}-${d.to}`, d])).values()
    );

    this.logger.log(`=== Extração Final ===`);
    this.logger.log(`Tool Calls: ${uniqueToolCalls.length}`);
    uniqueToolCalls.forEach((tc, idx) => {
      this.logger.log(`  [${idx}] ${tc.agent} -> ${tc.toolName} (${tc.success ? 'success' : 'pending'})`);
    });
    this.logger.log(`Delegações: ${uniqueDelegations.length}`);
    uniqueDelegations.forEach((d, idx) => {
      this.logger.log(`  [${idx}] ${d.from} -> ${d.to}: ${d.reason.substring(0, 50)}...`);
    });
    this.logger.log(`Reasoning: ${reasoning.length} steps`);
    this.logger.log(`Histórico: ${history.length} mensagens`);

    return {
      reasoning,
      toolCalls: uniqueToolCalls,
      delegations: uniqueDelegations,
      history,
    };
  }

  /**
   * Extrai pensamento de um item de reasoning
   */
  private extractThoughtFromReasoning(rawItem: any): string {
    if (rawItem.content && Array.isArray(rawItem.content)) {
      const thoughts: string[] = [];
      for (const entry of rawItem.content) {
        if (entry.type === 'input_text' && entry.text) {
          thoughts.push(entry.text);
        } else if (entry.text) {
          thoughts.push(entry.text);
        }
      }
      return thoughts.join(' ');
    }
    return rawItem.text || rawItem.content || 'Reasoning step';
  }

  /**
   * Parse argumentos de tool call
   */
  private parseToolArguments(rawItem: any): any {
    if (rawItem.function?.arguments) {
      try {
        return JSON.parse(rawItem.function.arguments);
      } catch {
        return rawItem.function.arguments;
      }
    }
    if (rawItem.arguments) {
      try {
        return typeof rawItem.arguments === 'string'
          ? JSON.parse(rawItem.arguments)
          : rawItem.arguments;
      } catch {
        return rawItem.arguments;
      }
    }
    return {};
  }

  /**
   * Parse resultado de tool call
   */
  private parseToolResult(rawItem: any): any {
    if (rawItem.content) {
      try {
        return typeof rawItem.content === 'string'
          ? JSON.parse(rawItem.content)
          : rawItem.content;
      } catch {
        return rawItem.content;
      }
    }
    return rawItem;
  }

  /**
   * Extrai texto do conteúdo de uma mensagem
   * O conteúdo pode ser string, array de objetos ou objeto complexo
   */
  private extractMessageContent(content: any): string {
    if (!content) return '';
    
    // Se for string, retorna diretamente
    if (typeof content === 'string') {
      return content;
    }
    
    // Se for array, extrai texto de cada item
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item?.text) return item.text;
          if (item?.content) return this.extractMessageContent(item.content);
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
    
    // Se for objeto, tenta extrair texto
    if (typeof content === 'object') {
      if (content.text) return content.text;
      if (content.content) return this.extractMessageContent(content.content);
      // Se não conseguir extrair, retorna JSON stringificado
      return JSON.stringify(content);
    }
    
    return String(content);
  }
}
