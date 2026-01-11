import { Injectable, Logger } from '@nestjs/common';
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';
import { ModelProviderFactory } from '../providers/model-provider.factory';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { AiCoreConfigService } from '../config/ai-core.config';
import { RAGTool } from '../tools/rag.tool';
import { DatabaseTool } from '../tools/database.tool';
import { NavigationTool } from '../tools/navigation.tool';
import { UserDataTool } from '../tools/user-data.tool';

/**
 * Response mode for adaptive RAG strategy
 * - fast: Zero-shot, top 1-3 chunks, quick response
 * - detailed: More context, top 6+ chunks, comprehensive response
 */
export type ResponseMode = 'fast' | 'detailed';

export interface EducaIACallOptions {
  tenantId: string;
  userId: string;
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  conversationId?: string;
  userRole?: string;
  userName?: string;
  userAvatar?: string;
  responseMode: ResponseMode;
  sendReasoning?: boolean;
}

export type EducaIAUIMessage = InferAgentUIMessage<typeof EducaIAAgent.prototype.agent>;

/**
 * Models that support reasoning/thinking
 */
const MODELS_WITH_REASONING = [
  'gpt-5',
  'gpt-5-mini',
  'claude-3-7',
  'claude-4',
  'claude-sonnet-4',
  'o1',
  'o3-mini',
];

/**
 * Check if a model supports reasoning
 */
export function supportsReasoning(model: string): boolean {
  return MODELS_WITH_REASONING.some((m) => model.includes(m));
}

/**
 * Detect question complexity to suggest response mode
 */
export function detectComplexity(question: string): 'simple' | 'complex' {
  const complexIndicators = [
    'como funciona',
    'explique detalhadamente',
    'passo a passo',
    'todos os',
    'complete',
    'arquitetura',
    'diferença entre',
    'diferenca entre',
    'compare',
    'liste todos',
    'descreva',
    'explique',
    'por que',
    'qual a diferença',
    'tutorial',
    'guia',
  ];

  const isComplex = complexIndicators.some((i) =>
    question.toLowerCase().includes(i),
  );

  return isComplex ? 'complex' : 'simple';
}

/**
 * EducaIA Agent - Advanced RAG Assistant for SmartGesTI Ensino
 *
 * Features:
 * - Adaptive response strategy (fast/detailed)
 * - Personalized user context (name, role, school)
 * - Multiple tools (RAG, Database, Navigation, UserData)
 * - Never invents information - always uses tools
 * - Friendly, didactic personality
 */
@Injectable()
export class EducaIAAgent {
  private readonly logger = new Logger(EducaIAAgent.name);
  public readonly agent: ToolLoopAgent<EducaIACallOptions>;

  constructor(
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
    private readonly ragTool: RAGTool,
    private readonly databaseTool: DatabaseTool,
    private readonly navigationTool: NavigationTool,
    private readonly userDataTool: UserDataTool,
  ) {
    // Get default model
    const provider = this.aiConfig.getDefaultProvider();
    const modelName =
      this.modelConfig.getProvider(provider)?.defaultModel || 'gpt-5-mini';
    const model = this.providerFactory.getModel(provider, modelName);

    if (!model) {
      throw new Error(
        `Model ${modelName} not available for provider ${provider}`,
      );
    }

    // System prompt for EducaIA
    const systemPrompt = `Você é o EducaIA, assistente virtual inteligente do SmartGesTI Ensino.

## PERSONALIDADE
- Amigável, didático e paciente
- Chame o usuário pelo nome quando disponível
- Explique conceitos de forma clara e acessível
- Seja proativo em sugerir ajuda adicional
- Use linguagem simples, evite jargões técnicos desnecessários
- Seja empático e entenda o contexto educacional

## REGRAS ABSOLUTAS
- **NUNCA** invente informações - se não souber, diga claramente
- **SEMPRE** use as tools para buscar dados quando não tiver certeza
- **SEMPRE** confirme operações sensíveis antes de executar
- Se não encontrar a informação nas tools, admita que não sabe
- Para operações de banco de dados, **SEMPRE** peça aprovação do usuário

## COMO USAR AS TOOLS

### retrieveKnowledge (RAG)
Use para buscar na base de conhecimento:
- Informações sobre funcionalidades do sistema
- Documentação de APIs e integrações
- Guias de uso de páginas e recursos
- Configurações e boas práticas

### queryDatabase (requer aprovação)
Use para consultar dados específicos:
- Estatísticas (quantidade de usuários, escolas)
- Dados específicos de configuração
- Informações de registros do sistema
⚠️ SEMPRE peça aprovação antes de executar queries

### navigateToPage
Use para sugerir páginas do sistema:
- Quando o usuário pergunta "onde encontro..."
- Para direcionar a funcionalidades específicas
- Para mostrar caminhos no menu

### getUserData
Use para obter dados do próprio usuário:
- Preferências salvas
- Histórico de ações recentes
- Dados da escola vinculada

## REGRA DE NAVEGAÇÃO (CRÍTICO - SIGA SEMPRE)
- **SEMPRE** que for mencionar QUALQUER funcionalidade acessível do sistema, você DEVE usar a tool \`navigateToPage\` ANTES de responder
- A tool gera botões de navegação clicáveis automaticamente - NÃO escreva rotas no texto
- **NUNCA** escreva rotas técnicas como "/escola/:slug/...", "rota: /...", ou qualquer URL/path
- **NUNCA** escreva "(rota: ...)" ou similar - o usuário não entende rotas técnicas
- Apenas mencione o caminho do menu de forma amigável: "EducaIA > Ver Agentes"
- Se a tool navigateToPage foi usada, os botões aparecerão automaticamente - não precisa descrever rotas

## ESTRATÉGIA DE RESPOSTA
- O modo de resposta (Rápido ou Detalhado) é definido pelo usuário na interface
- NÃO sugira "ativar modo detalhado" - você não pode alterar configurações
- NÃO diga "quer que eu ative?" ou "posso abrir a página" - você não pode executar ações na interface
- Seja versátil: responda sobre QUALQUER funcionalidade do sistema (acadêmico, financeiro, administrativo, RH, IA, etc.)

## O QUE VOCÊ NÃO PODE FAZER
- NÃO pode ativar/desativar modos ou configurações
- NÃO pode navegar para páginas ou abrir links (apenas sugerir com a tool navigateToPage)
- NÃO pode executar ações no sistema além de consultar dados
- NÃO prometa fazer coisas que não pode - seja honesto sobre suas limitações

## FORMATO DAS RESPOSTAS
- Use markdown para formatação (listas, negrito, código)
- Para passos, use listas numeradas
- Para dicas, use blocos de destaque
- Mencione funcionalidades pelo nome amigável: "Ver Agentes", "Criar Agente IA"
- **PROIBIDO**: Escrever rotas, paths, URLs ou qualquer texto técnico como "/escola/:slug/..."
- Os botões de navegação são gerados automaticamente pela tool - confie nela`;

    // Create agent with call options schema
    this.agent = new ToolLoopAgent<EducaIACallOptions>({
      model,
      instructions: systemPrompt,
      callOptionsSchema: z.object({
        tenantId: z.string().describe('ID do tenant (obrigatório)'),
        userId: z.string().describe('ID do usuário (obrigatório)'),
        schoolId: z.string().optional().describe('ID da escola'),
        schoolName: z.string().optional().describe('Nome da escola'),
        schoolSlug: z.string().optional().describe('Slug da escola para URLs'),
        conversationId: z.string().optional().describe('ID da conversa'),
        userRole: z
          .string()
          .optional()
          .describe('Papel do usuário (admin, teacher, student)'),
        userName: z.string().optional().describe('Nome do usuário'),
        userAvatar: z.string().optional().describe('URL do avatar do usuário'),
        responseMode: z
          .enum(['fast', 'detailed'])
          .describe('Modo de resposta: fast (rápido) ou detailed (detalhado)'),
        sendReasoning: z
          .boolean()
          .optional()
          .describe('Se deve incluir raciocínio/pensamento'),
      }),
      prepareCall: ({ options, ...settings }) => {
        // Build personalized context
        const contextParts: string[] = [];

        if (options.userName) {
          contextParts.push(`👤 Usuário: ${options.userName}`);
        }
        if (options.userRole) {
          const roleLabels: Record<string, string> = {
            admin: 'Administrador',
            teacher: 'Professor',
            student: 'Aluno',
            coordinator: 'Coordenador',
            secretary: 'Secretário',
          };
          contextParts.push(
            `🎭 Papel: ${roleLabels[options.userRole] || options.userRole}`,
          );
        }
        if (options.schoolName) {
          contextParts.push(`🏫 Escola: ${options.schoolName}`);
        } else if (options.schoolId) {
          contextParts.push(`🏫 Escola ID: ${options.schoolId}`);
        }

        // Mode-specific instructions - make it VERY clear which mode is active
        const modeInstructions =
          options.responseMode === 'fast'
            ? '\n\n## MODO ATUAL: RÁPIDO ⚡\nVocê está no modo RÁPIDO. Seja conciso e direto. Use no máximo 3 resultados do RAG. NÃO sugira mudar para modo detalhado.'
            : '\n\n## MODO ATUAL: DETALHADO 📚\nVocê está no modo DETALHADO. Forneça explicações completas com exemplos e contexto. Use até 6+ resultados do RAG. Você JÁ está no modo mais completo.';

        // Build enhanced instructions
        const userContext =
          contextParts.length > 0
            ? `\n\n## CONTEXTO DO USUÁRIO ATUAL\n${contextParts.join('\n')}`
            : '';

        const enhancedInstructions = `${settings.instructions}${userContext}${modeInstructions}`;

        // Create tools with context
        const tools: Record<string, any> = {};

        // RAG Tool with adaptive mode
        tools.retrieveKnowledge = this.ragTool.createTool({
          tenantId: options.tenantId,
          userId: options.userId,
          schoolId: options.schoolId,
          responseMode: options.responseMode,
        });

        // Database Tool (with approval)
        tools.queryDatabase = this.databaseTool.createTool({
          tenantId: options.tenantId,
          userId: options.userId,
          schoolId: options.schoolId,
        });

        // Navigation Tool
        tools.navigateToPage = this.navigationTool.createTool({
          tenantId: options.tenantId,
          userId: options.userId,
          schoolId: options.schoolId,
          schoolSlug: options.schoolSlug,
        });

        // User Data Tool
        tools.getUserData = this.userDataTool.createTool({
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
      // Stop after 15 steps to prevent infinite loops (less than SupportAgent since we have more tools)
      stopWhen: stepCountIs(15),
    });

    this.logger.log(`EducaIAAgent initialized with model ${modelName}`);
  }

  /**
   * Generate response using the agent
   */
  async generate(
    prompt: string,
    options: EducaIACallOptions,
  ): Promise<Awaited<ReturnType<typeof this.agent.generate>>> {
    this.logger.debug(
      `EducaIA generating response for user ${options.userName || options.userId} (mode: ${options.responseMode})`,
    );

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
    options: EducaIACallOptions,
  ): ReturnType<typeof this.agent.stream> {
    this.logger.debug(
      `EducaIA streaming response for user ${options.userName || options.userId} (mode: ${options.responseMode})`,
    );

    return this.agent.stream({
      prompt,
      options,
    });
  }

  /**
   * Check if a question might need detailed mode
   * Returns suggestion to switch if complexity detected in fast mode
   */
  shouldSuggestDetailedMode(
    question: string,
    currentMode: ResponseMode,
  ): boolean {
    if (currentMode === 'detailed') return false;
    return detectComplexity(question) === 'complex';
  }
}
