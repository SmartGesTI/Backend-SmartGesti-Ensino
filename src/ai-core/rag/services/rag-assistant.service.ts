import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SupabaseService } from '../../../supabase/supabase.service';
import { EmbeddingService } from './embedding.service';
import { OpenAIService } from '../../../agents/shared/llm/openai.service';
import { ChatMessageDto } from '../dto';
import { RagToolsService } from '../tools/rag-tools.service';
import { RAG_TOOLS, RagToolName } from '../tools/rag-tools.types';
import {
  StreamingEvent,
  LLMMessage,
} from '../../../agents/shared/llm/llm.types';

export interface AnswerResult {
  answer: string;
  context: string;
  usedTools?: string[];
  toolResults?: Record<string, any>; // Resultados brutos das tools para o frontend processar
}

/**
 * System prompt estático com regras, formato, CoT e few-shot examples
 * Separado do contexto dinâmico para melhor consistência
 */
const SYSTEM_PROMPT = `Você é o EducaIA, um assistente de suporte, tutorial e conhecimento do SmartGesti-Ensino, um sistema de gestão escolar. Você atua como uma base de conhecimento e tem acesso a todos os dados da aplicação para ajudar os usuários com suas dúvidas. É esperado que você utilize qualquer ferramenta disponível de acordo com o contexto apresentado e seja inteligente o suficiente para decidir qual ferramenta utilizar quando necessário para responder de forma adequada.

## REGRAS OBRIGATÓRIAS
1. Responda APENAS com informações presentes no CONTEXTO fornecido pelo usuário, seja amigável, educacional e informativo.
2. Se a informação não estiver no contexto, use o padrão de recusa abaixo
3. Nunca invente funcionalidades, caminhos de menu ou dados que não estão no contexto

## FORMATO DE RESPOSTA
- Use listas e bullet points para passos sequenciais
- Destaque caminhos de menu em negrito: **Menu > Submenu**
- Seja conciso mas completo
- Para perguntas sobre "como fazer", forneça passos numerados
- Verifique se o MD de saída está formatado corretamente, se não estiver, corrija-o.

## RACIOCÍNIO (pense antes de responder)
Antes de gerar a resposta final:
1. Identifique quais documentos do contexto são relevantes para a pergunta
2. Verifique se a pergunta pode ser respondida completamente com o contexto
3. Se houver múltiplas fontes, combine as informações de forma coerente

## PADRÃO DE RECUSA
Se a informação não estiver no contexto, responda:
Infelizmente, não encontrei informações sobre no contexto disponível. Posso ajudar com outras informações?

## FERRAMENTAS (TOOLS) - IMPORTANTE!
Você tem acesso a ferramentas que buscam dados REAIS do banco de dados.
Sempre que as ferramentas puderem adicionar valor à resposta, use-as!

**OBRIGATÓRIO usar "list_public_agents"** quando a pergunta mencionar:
- "agentes disponíveis", "agentes públicos", "quais agentes", "listar agentes"
- "templates", "modelos de agente"
- "o que posso usar", "agentes existentes"

**OBRIGATÓRIO usar "get_agent_details"** quando perguntar sobre:
- Um agente específico pelo nome
- "como funciona o agente X", "detalhes do agente Y"

Quando usar ferramentas, apresente os dados retornados de forma organizada, listando nome, descrição, categoria e caso de uso de cada agente.

## EXEMPLOS

**Exemplo 1 - Pergunta sobre funcionalidade existente:**
Pergunta: "Como vejo os alunos cadastrados?"
Resposta: "Para visualizar os alunos, acesse **Acadêmico > Alunos** no menu lateral. Nesta página você pode visualizar a lista de alunos matriculados, filtrar por turma e acessar os detalhes de cada aluno. (Fonte: alunos.md)"

**Exemplo 2 - Pergunta fora do contexto:**
Pergunta: "Qual o preço do sistema?"
Resposta: "Não encontrei informações sobre preços na documentação. Posso ajudar com funcionalidades como gestão de alunos, turmas ou o módulo financeiro."

**Exemplo 3 - Pergunta com múltiplos passos:**
Pergunta: "Como criar um agente de IA?"
Resposta: "Para criar um agente de IA, siga estes passos:
1. Acesse **EducaIA > Criar Agente IA**
2. Use o editor visual drag-and-drop
3. Adicione nós de Entrada, Processamento (Agente IA) e Saída
4. Conecte os nós na sequência desejada
5. Configure as instruções do agente
6. Clique em Validar e depois Salvar
`;

@Injectable()
export class RagAssistantService {
  private readonly logger = new Logger(RagAssistantService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly openaiService: OpenAIService,
    private readonly ragToolsService: RagToolsService,
  ) {}

  /**
   * Formata o contexto recuperado de forma estruturada
   */
  private formatContext(chunks: any[]): string {
    return chunks
      .map((chunk: any, idx: number) => {
        const title =
          chunk.document_title || chunk.section_title || 'Documento';
        return `[Fonte ${idx + 1}: ${title}]\n${chunk.content}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Monta o user prompt dinâmico com contexto e pergunta
   */
  private buildUserPrompt(context: string, question: string): string {
    return `## CONTEXTO RECUPERADO DA BASE DE CONHECIMENTO
${context}

## PERGUNTA DO USUÁRIO
${question}

## SUA RESPOSTA
Analise o contexto acima e responda à pergunta seguindo as regras e formato especificados.`;
  }

  /**
   * Detecta se a pergunta deve forçar o uso de uma tool específica
   * GPT-5-nano tem dificuldade em decidir sozinho quando usar tools
   * Retorna também o nome do agente extraído da pergunta (se aplicável)
   */
  private detectRequiredTool(
    question: string,
    history?: ChatMessageDto[],
  ): {
    required: boolean;
    toolName?: RagToolName;
    extractedAgentName?: string;
  } {
    const q = question.toLowerCase();

    // Patterns para list_public_agents
    const listAgentsPatterns = [
      'agentes públicos',
      'agentes disponíveis',
      'quais agentes',
      'listar agentes',
      'lista de agentes',
      'templates de agentes',
      'modelos de agente',
      'agentes existentes',
      'ver agentes',
      'mostrar agentes',
    ];

    if (listAgentsPatterns.some((p) => q.includes(p))) {
      return { required: true, toolName: 'list_public_agents' };
    }

    // Patterns para get_agent_details - MUITO mais abrangente
    const detailsPatterns = [
      'detalhes do agente',
      'detalhe do agente',
      'detalhes sobre',
      'mais detalhes',
      'mostre detalhes',
      'mostra detalhes',
      'como funciona o agente',
      'como funciona o',
      'sobre o agente',
      'explique o agente',
      'explique o',
      'me fale sobre',
      'fale sobre o',
      'informações do',
      'informações sobre',
      'o que faz o',
      'o que é o agente',
      'descreva o agente',
      'descreva o',
    ];

    // Nomes de agentes conhecidos (para detectar menções diretas)
    const knownAgentNames = [
      'analisador de currículos',
      'analisador de curriculos',
      'gerador de boletins',
      'sumarizador de textos',
      'sumarizador',
      'analisador',
      'gerador',
    ];

    // Verificar se menciona um agente conhecido diretamente
    for (const agentName of knownAgentNames) {
      if (q.includes(agentName)) {
        // Extrair nome completo do agente
        let extractedName = agentName;
        if (agentName === 'analisador' && q.includes('curr')) {
          extractedName = 'Analisador de Currículos';
        } else if (agentName === 'gerador' && q.includes('boletins')) {
          extractedName = 'Gerador de Boletins';
        } else if (agentName === 'sumarizador') {
          extractedName = 'Sumarizador de Textos';
        }
        return {
          required: true,
          toolName: 'get_agent_details',
          extractedAgentName: extractedName,
        };
      }
    }

    // Verificar patterns de detalhes
    if (detailsPatterns.some((p) => q.includes(p))) {
      return { required: true, toolName: 'get_agent_details' };
    }

    // Verificar no histórico se o usuário está pedindo detalhes de algo mencionado antes
    // Ex: "sim, mostre os detalhes" após listar agentes
    const confirmationPatterns = [
      'sim',
      'ok',
      'pode ser',
      'faça',
      'mostre',
      'mostra',
      'quero',
      'gostaria',
    ];
    const detailsKeywords = [
      'detalhes',
      'detalhe',
      'mais',
      'completo',
      'busca',
      'buscar',
    ];

    const hasConfirmation = confirmationPatterns.some((p) => q.includes(p));
    const hasDetailsKeyword = detailsKeywords.some((p) => q.includes(p));

    if (hasConfirmation && hasDetailsKeyword && history && history.length > 0) {
      // Verificar se o histórico menciona algum agente
      const lastAssistantMsg = history
        .filter((m) => m.role === 'assistant')
        .pop();
      if (lastAssistantMsg) {
        const content = lastAssistantMsg.content.toLowerCase();
        for (const agentName of knownAgentNames) {
          if (content.includes(agentName)) {
            return { required: true, toolName: 'get_agent_details' };
          }
        }
      }
    }

    return { required: false };
  }

  /**
   * Responde uma pergunta usando RAG com suporte a histórico de conversa e tools
   */
  async answerQuestion(
    question: string,
    history?: ChatMessageDto[],
    tenantId?: string,
    schoolId?: string,
  ): Promise<AnswerResult> {
    this.logger.log(
      `Processing question: ${question} (tenant: ${tenantId}, school: ${schoolId})`,
    );

    // Detectar se deve forçar uso de tool (GPT-5-nano precisa de ajuda)
    const toolDetection = this.detectRequiredTool(question, history);
    if (toolDetection.required) {
      this.logger.log(
        `Detected required tool: ${toolDetection.toolName}${toolDetection.extractedAgentName ? ` (agent: ${toolDetection.extractedAgentName})` : ''}`,
      );
    }

    // Buscar contexto da knowledge base
    const embeddingResult =
      await this.embeddingService.generateEmbedding(question);
    const questionEmbedding = embeddingResult.embedding;
    const relevantChunks = await this.searchSimilarChunks(questionEmbedding, 5);

    const context =
      relevantChunks.length > 0
        ? this.formatContext(relevantChunks)
        : 'Nenhum documento relevante encontrado na base de conhecimento.';

    const userPrompt = this.buildUserPrompt(context, question);

    // Montar mensagens: system (estático) + histórico + user (dinâmico)
    const messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      tool_calls?: any[];
      tool_call_id?: string;
      name?: string;
    }> = [{ role: 'system', content: SYSTEM_PROMPT }];

    // Adicionar histórico de conversa (limitar a últimas 10 mensagens)
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Adicionar user prompt com contexto e pergunta
    messages.push({ role: 'user', content: userPrompt });

    // Configurar tool_choice baseado na detecção
    // Se detectou keyword, forçar uso da tool (GPT-5-nano precisa de ajuda para decidir)
    let toolChoice: any = 'auto';
    if (toolDetection.required && toolDetection.toolName) {
      toolChoice = {
        type: 'function',
        function: { name: toolDetection.toolName },
      };
      this.logger.log(`Forcing tool_choice to: ${toolDetection.toolName}`);
    }

    // Primeira chamada - pode retornar tool_calls
    const response = await this.openaiService.chat({
      model: 'gpt-5-nano',
      messages,
      max_tokens: 700,
      tools: RAG_TOOLS as any,
      tool_choice: toolChoice,
    });

    const usedTools: string[] = [];
    const toolResults: Record<string, any> = {};

    // Se houver tool_calls, executar e fazer segunda chamada
    if (response.tool_calls && response.tool_calls.length > 0) {
      this.logger.log(
        `Tool calls detected: ${response.tool_calls.map((tc) => tc.function.name).join(', ')}`,
      );

      // Adicionar resposta do assistente com tool_calls
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls,
      });

      // Executar cada tool e adicionar resultado
      for (const toolCall of response.tool_calls) {
        const toolName = toolCall.function.name as RagToolName;
        let toolArgs = JSON.parse(toolCall.function.arguments || '{}');

        // Se detectamos um nome de agente na pergunta e a tool precisa, usar ele
        if (
          toolName === 'get_agent_details' &&
          toolDetection.extractedAgentName &&
          !toolArgs.agentName
        ) {
          toolArgs.agentName = toolDetection.extractedAgentName;
          this.logger.log(
            `Using extracted agent name: ${toolDetection.extractedAgentName}`,
          );
        }

        usedTools.push(toolName);
        this.logger.log(
          `Executing tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`,
        );

        const toolResult = await this.ragToolsService.executeTool(
          toolName,
          toolArgs,
          tenantId,
          schoolId,
        );

        // Armazenar resultado da tool para o frontend
        if (toolResult.success && toolResult.data) {
          toolResults[toolName] = toolResult.data;
        }

        // Adicionar resultado da tool
        messages.push({
          role: 'tool',
          content: JSON.stringify(
            toolResult.success ? toolResult.data : { error: toolResult.error },
          ),
          tool_call_id: toolCall.id,
          name: toolName,
        });
      }

      // Segunda chamada para gerar resposta final com os resultados das tools
      const finalResponse = await this.openaiService.chat({
        model: 'gpt-5-nano',
        messages,
        max_tokens: 900, // Mais tokens para resposta com dados das tools
      });

      return {
        answer: finalResponse.content,
        context,
        usedTools,
        toolResults,
      };
    }

    // Sem tool calls - retornar resposta direta
    return {
      answer: response.content,
      context,
      usedTools: [],
    };
  }

  /**
   * Regenera uma resposta (pode usar temperatura diferente para variar)
   */
  async regenerateAnswer(
    question: string,
    history?: ChatMessageDto[],
  ): Promise<AnswerResult> {
    this.logger.log('Regenerating answer for: ' + question);

    // Por enquanto, simplesmente chama answerQuestion novamente
    // Futuramente pode usar temperatura maior para respostas diferentes
    return this.answerQuestion(question, history);
  }

  /**
   * Responde uma pergunta com streaming (SSE)
   */
  streamAnswer(
    question: string,
    history: ChatMessageDto[] | undefined,
    tenantId: string | undefined,
    schoolId: string | undefined,
  ): Observable<StreamingEvent> {
    const subject = new Subject<StreamingEvent>();

    // Executar de forma assíncrona
    this.executeStreaming(question, history, tenantId, schoolId, subject).catch(
      (error) => {
        subject.error(error);
      },
    );

    return subject.asObservable();
  }

  private async executeStreaming(
    question: string,
    history: ChatMessageDto[] | undefined,
    tenantId: string | undefined,
    schoolId: string | undefined,
    subject: Subject<StreamingEvent>,
  ): Promise<void> {
    const requestId = `rag-stream-${Date.now()}`;

    try {
      this.logger.log(
        `[${requestId}] Iniciando streaming para: ${question.substring(0, 50)}...`,
      );

      // Detectar se deve forçar uso de tool
      const toolDetection = this.detectRequiredTool(question, history);
      if (toolDetection.required) {
        this.logger.log(
          `[${requestId}] Tool detectada: ${toolDetection.toolName}`,
        );
      }

      // Buscar contexto da knowledge base
      const embeddingResult =
        await this.embeddingService.generateEmbedding(question);
      const questionEmbedding = embeddingResult.embedding;
      const relevantChunks = await this.searchSimilarChunks(
        questionEmbedding,
        5,
      );

      const context =
        relevantChunks.length > 0
          ? this.formatContext(relevantChunks)
          : 'Nenhum documento relevante encontrado na base de conhecimento.';

      const userPrompt = this.buildUserPrompt(context, question);

      // Montar mensagens
      const messages: LLMMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      if (history && history.length > 0) {
        const recentHistory = history.slice(-10);
        for (const msg of recentHistory) {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }

      messages.push({ role: 'user', content: userPrompt });

      // Configurar tool_choice
      let toolChoice: any = 'auto';
      if (toolDetection.required && toolDetection.toolName) {
        toolChoice = {
          type: 'function',
          function: { name: toolDetection.toolName },
        };
      }

      // Primeira chamada (pode ter tool_calls)
      const response = await this.openaiService.chat({
        model: 'gpt-5-nano',
        messages,
        max_tokens: 700,
        tools: RAG_TOOLS as any,
        tool_choice: toolChoice,
      });

      const usedTools: string[] = [];
      const toolResults: Record<string, any> = {};

      // Se houver tool_calls, executar
      if (response.tool_calls && response.tool_calls.length > 0) {
        this.logger.log(
          `[${requestId}] Tool calls: ${response.tool_calls.map((tc) => tc.function.name).join(', ')}`,
        );

        messages.push({
          role: 'assistant',
          content: response.content || '',
          tool_calls: response.tool_calls,
        });

        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function.name as RagToolName;
          let toolArgs = JSON.parse(toolCall.function.arguments || '{}');

          if (
            toolName === 'get_agent_details' &&
            toolDetection.extractedAgentName &&
            !toolArgs.agentName
          ) {
            toolArgs.agentName = toolDetection.extractedAgentName;
          }

          usedTools.push(toolName);

          // Emitir evento de tool_call
          subject.next({
            type: 'tool_call',
            data: { name: toolName, arguments: toolArgs },
            timestamp: Date.now(),
          });

          const toolResult = await this.ragToolsService.executeTool(
            toolName,
            toolArgs,
            tenantId,
            schoolId,
          );

          if (toolResult.success && toolResult.data) {
            toolResults[toolName] = toolResult.data;
          }

          // Emitir evento de tool_result
          subject.next({
            type: 'tool_result',
            data: { name: toolName, result: toolResult },
            timestamp: Date.now(),
          });

          messages.push({
            role: 'tool',
            content: JSON.stringify(
              toolResult.success
                ? toolResult.data
                : { error: toolResult.error },
            ),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }
      }

      // Segunda chamada com streaming
      const stream = this.openaiService.streamChat({
        model: 'gpt-5-nano',
        messages,
        max_tokens: 900,
        stream: true,
      });

      let accumulatedContent = '';

      stream.subscribe({
        next: (event: StreamingEvent) => {
          if (event.type === 'token') {
            const tokenContent = event.data.content || event.data.delta || '';
            accumulatedContent += tokenContent;
            subject.next({
              type: 'token',
              data: { content: tokenContent, delta: tokenContent },
              timestamp: Date.now(),
            });
          } else if (event.type === 'thinking') {
            subject.next({
              type: 'thinking',
              data: event.data,
              timestamp: Date.now(),
            });
          }
        },
        error: (error: any) => {
          this.logger.error(`[${requestId}] Erro no stream: ${error.message}`);
          subject.next({
            type: 'error',
            data: { message: error.message },
            timestamp: Date.now(),
          });
          subject.complete();
        },
        complete: () => {
          this.logger.log(
            `[${requestId}] Stream completo. Texto: ${accumulatedContent.length} chars`,
          );
          subject.next({
            type: 'done',
            data: {
              final_response: accumulatedContent,
              usedTools,
              toolResults,
            },
            timestamp: Date.now(),
          });
          subject.complete();
        },
      });
    } catch (error: any) {
      this.logger.error(`[${requestId}] Erro: ${error.message}`);
      subject.next({
        type: 'error',
        data: { message: error.message },
        timestamp: Date.now(),
      });
      subject.complete();
    }
  }

  private async searchSimilarChunks(
    embedding: number[],
    limit = 5,
  ): Promise<any[]> {
    const embeddingStr = this.embeddingService.embeddingToVector(embedding);

    const client = this.supabase.getClient();
    const { data: results, error } = await client.rpc('match_rag_chunks', {
      query_embedding: embeddingStr,
      match_threshold: 0.5,
      match_count: limit,
    });

    if (error) {
      this.logger.error('Error searching similar chunks: ' + error.message);
      return [];
    }

    return results || [];
  }
}
