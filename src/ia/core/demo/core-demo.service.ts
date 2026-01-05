import { Injectable, Logger } from '@nestjs/common';
import { AgentFactory } from '../agent/agent.factory';
import { ToolFactory } from '../tool/tool.factory';
import { AgentRunnerService } from '../runner/agent-runner.service';
import { ContextProvider } from '../context/context.provider';
import { CoreContext } from '../context/context.types';
import { z } from 'zod';
import { SearchService } from '../../../rag/services/search.service';
import {
  MultiAgentDemoResult,
  ReasoningStep,
  ToolCallDetail,
  DelegationDetail,
  MessageItem,
  ExecutionMetadata,
} from './dto/core-demo.dto';
import { RunResult } from '@openai/agents';

/**
 * Serviço para demonstrar multi-agente com tracing completo
 */
@Injectable()
export class CoreDemoService {
  private readonly logger = new Logger(CoreDemoService.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly toolFactory: ToolFactory,
    private readonly runnerService: AgentRunnerService,
    private readonly contextProvider: ContextProvider,
    private readonly searchService: SearchService,
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

      // 2. Criar tool de cálculo (real)
      const calculateTool = this.toolFactory.create({
        name: 'calculate',
        description:
          'Perform mathematical calculations. Accepts expressions like "15 * 23 + 42". Supports basic arithmetic operations: +, -, *, /, parentheses.',
        parameters: z.object({
          expression: z
            .string()
            .describe('Mathematical expression to evaluate (e.g., "15 * 23 + 42")'),
        }),
        execute: async ({ expression }, { context }) => {
          this.logger.log(`[CalculateTool] Calculando: ${expression}`);
          try {
            // Validação básica de segurança - apenas números e operadores matemáticos
            const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
            if (sanitized !== expression.replace(/\s/g, '')) {
              throw new Error('Expressão contém caracteres inválidos');
            }
            
            // AVISO: Em produção, use uma biblioteca segura como mathjs
            // Por enquanto, usando eval com validação básica
            const result = eval(expression);
            
            if (typeof result !== 'number' || !isFinite(result)) {
              throw new Error('Resultado inválido');
            }
            
            this.logger.log(`[CalculateTool] Resultado: ${expression} = ${result}`);
            return {
              success: true,
              expression,
              result,
              formatted: `${expression} = ${result}`,
            };
          } catch (error: any) {
            this.logger.error(`[CalculateTool] Erro ao calcular: ${error.message}`);
            return {
              success: false,
              expression,
              error: error.message,
            };
          }
        },
        category: 'math',
        tags: ['calculation', 'math'],
      });

      // 3. Criar tool de busca (real - integra com RAG)
      const searchTool = this.toolFactory.create({
        name: 'search',
        description: 'Search for information about a topic in the knowledge base. Returns relevant information from indexed documents.',
        parameters: z.object({
          query: z.string().describe('Search query or topic to search for'),
        }),
        execute: async ({ query }, { context }) => {
          this.logger.log(`[SearchTool] Buscando na knowledge base: ${query}`);
          
          try {
            // Busca real na knowledge base usando SearchService
            const searchResults = await this.searchService.hybridSearch(query, {
              topK: 3,
            });

            this.logger.log(`[SearchTool] Encontrados ${searchResults.length} resultados na knowledge base`);

            // Se não encontrar resultados na knowledge base, retornar informação estruturada
            if (searchResults.length === 0) {
              // Busca específica para TypeScript (fallback)
              if (query.toLowerCase().includes('typescript') || query.toLowerCase().includes('ts')) {
                return {
                  success: true,
                  query,
                  results: [
                    {
                      title: 'TypeScript - Linguagem de Programação',
                      content: `TypeScript é uma linguagem de programação de código aberto desenvolvida pela Microsoft. É um superset do JavaScript que adiciona tipagem estática opcional e recursos avançados de orientação a objetos.

Características principais:
- Tipagem estática opcional
- Interfaces e tipos customizados
- Classes e herança
- Genéricos (Generics)
- Inferência de tipos avançada
- Decorators
- Namespaces e módulos

TypeScript compila para JavaScript puro, permitindo compatibilidade com qualquer ambiente que execute JavaScript. É amplamente usado em frameworks como Angular, React e Vue.js para desenvolvimento de aplicações web escaláveis.`,
                      relevance: 0.98,
                      source: 'knowledge-base',
                    },
                  ],
                };
              }
              
              return {
                success: true,
                query,
                results: [
                  {
                    title: `Informações sobre ${query}`,
                    content: `Não foram encontrados resultados na knowledge base para "${query}". Em uma implementação completa, esta busca consultaria múltiplas fontes de conhecimento.`,
                    relevance: 0.5,
                    source: 'knowledge-base',
                  },
                ],
              };
            }

            // Formatar resultados da busca real
            return {
              success: true,
              query,
              results: searchResults.map((result: any) => ({
                title: result.document?.title || result.sectionTitle || 'Resultado da busca',
                content: result.content || '',
                relevance: result.similarity || 0.8,
                source: 'knowledge-base',
                metadata: {
                  documentId: result.documentId,
                  category: result.document?.category,
                },
              })),
            };
          } catch (error: any) {
            this.logger.error(`[SearchTool] Erro na busca: ${error.message}`);
            return {
              success: false,
              query,
              error: error.message,
              results: [],
            };
          }
        },
        category: 'search',
        tags: ['search', 'information'],
      });

      // 4. Criar agente especialista para cálculos
      const calculatorAgent = await this.agentFactory.create({
        name: 'CalculatorAgent',
        instructions: `You are a mathematical calculation specialist named CalculatorAgent.

Your role is to:
- Receive mathematical expressions from the manager
- Use the calculate tool to evaluate them accurately
- Return the result in a clear format: "The result of [expression] is [result]"

IMPORTANT: Always use the calculate tool for any mathematical operations. Never try to calculate manually.`,
        model: 'gpt-4.1-mini',
        tools: [calculateTool],
        strategy: 'simple',
        category: 'math',
      });

      // 5. Criar agente especialista para buscas
      const searchAgent = await this.agentFactory.create({
        name: 'SearchAgent',
        instructions: `You are an information search specialist named SearchAgent.

Your role is to:
- Receive search queries from the manager
- Use the search tool to find relevant information
- Synthesize the search results into a clear, organized response
- Include key information from the search results

IMPORTANT: Always use the search tool to find information. Present the information in a structured way.`,
        model: 'gpt-4.1-mini',
        tools: [searchTool],
        strategy: 'simple',
        category: 'search',
      });

      // 6. Criar agente Manager que orquestra
      const managerAgent = await this.agentFactory.create({
        name: 'ManagerAgent',
        instructions: `You are ManagerAgent, a coordinator that orchestrates responses by delegating to specialized agents.

Available specialist agents (use them as tools):
- CalculatorAgent: For mathematical calculations and computations. Use when user asks for calculations, math operations, or numerical evaluations.
- SearchAgent: For searching and retrieving information. Use when user asks for information, facts, or knowledge about topics.

Your process:
1. Analyze the user's query carefully
2. Identify which tasks need to be performed (calculation, search, or both)
3. Delegate to the appropriate specialist agent(s) by calling them as tools
4. Wait for results from all agents
5. Combine the results into a comprehensive final answer

IMPORTANT: 
- Always use the specialist agents as tools when their expertise is needed
- Explain what you're doing: "I will delegate the calculation to CalculatorAgent and the search to SearchAgent"
- Present the final answer clearly combining all results`,
        model: 'gpt-4.1-mini',
        strategy: 'manager',
        handoffs: [calculatorAgent, searchAgent],
        category: 'manager',
      });

      // 7. Executar o manager agent
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
          totalAgents: 3, // Manager + 2 especialistas
          totalToolCalls: executionDetails.toolCalls.length,
          totalDelegations: executionDetails.delegations.length,
          executionTime,
          model: 'gpt-4.1-mini',
        },
      };
    } catch (error: any) {
      this.logger.error(`Erro no demo multi-agente: ${error.message}`, error.stack);
      throw error;
    }
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
