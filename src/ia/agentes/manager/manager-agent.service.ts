import { Injectable, Logger } from '@nestjs/common';
import { AgentFactory } from '../../core/agent/agent.factory';
import { AgentRegistry } from '../../core/agent/agent.registry';
import { CoreAgent } from '../../core/agent/agent.types';
import { CoreContext } from '../../core/context/context.types';

/**
 * Service para criar e gerenciar o ManagerAgent
 * O ManagerAgent descobre dinamicamente todos os agentes do sistema via AgentRegistry
 */
@Injectable()
export class ManagerAgentService {
  private readonly logger = new Logger(ManagerAgentService.name);

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  /**
   * Cria o ManagerAgent com descoberta dinâmica de agentes
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(_context: CoreContext): Promise<CoreAgent<CoreContext>> {
    this.logger.log('Criando ManagerAgent com descoberta dinâmica');

    // 1. Descobrir todos os agentes registrados
    const allAgents = this.agentRegistry.list();
    this.logger.log(`Encontrados ${allAgents.length} agentes no registry`);

    // 2. Filtrar agentes especialistas (excluir managers para evitar recursão)
    const specialistAgents = allAgents.filter(
      (agent) => agent.category !== 'manager' && agent.name !== 'ManagerAgent',
    );

    this.logger.log(
      `Filtrando ${specialistAgents.length} agentes especialistas`,
    );

    // 3. Construir instruções dinamicamente (sem tools compartilhadas)
    const instructions = this.buildDynamicInstructions(specialistAgents);

    // 4. Criar ManagerAgent (sem tools compartilhadas - apenas agentes)
    const agent = await this.agentFactory.create({
      name: 'ManagerAgent',
      instructions,
      model: 'gpt-5-mini',
      strategy: 'manager',
      handoffs: specialistAgents,
      tools: [], // Sem tools compartilhadas - apenas agentes especialistas
      category: 'manager',
      tags: ['orchestration', 'manager'],
      modelSettings: {
        temperature: 0.7,
        maxTokens: 4096,
        parallelToolCalls: true,
        reasoningEffort: 'minimal', // Reduzir tempo de resposta
      },
    });

    // Registrar no registry
    this.agentRegistry.register(agent);

    this.logger.log(
      `ManagerAgent criado com ${specialistAgents.length} agentes especialistas (sem tools compartilhadas)`,
    );

    return agent;
  }

  /**
   * Constrói instruções dinamicamente baseadas nos agentes disponíveis
   */
  private buildDynamicInstructions(specialistAgents: CoreAgent[]): string {
    // Construir descrição dos agentes especialistas com nome da tool
    const agentDescriptions = specialistAgents
      .map((agent) => {
        const category = agent.category || 'geral';
        const tags = agent.tags?.join(', ') || '';
        const toolName = `${agent.name.toLowerCase().replace(/\s+/g, '_')}_agent`;
        return `- **${toolName}** (${agent.name}): Agente especialista em ${category}${tags ? ` (tags: ${tags})` : ''}`;
      })
      .join('\n');

    return `Você é o ManagerAgent, o coordenador silencioso do SmartGesti-Ensino que orquestra respostas delegando para agentes especialistas internos.

AGENTES ESPECIALISTAS INTERNOS DISPONÍVEIS (use-os como tools):
${agentDescriptions || '- Nenhum agente especialista disponível no momento'}

REGRAS DE DELEGAÇÃO (OBRIGATÓRIO):
1. **SEMPRE delegue para agentes especialistas** - eles têm expertise completa e sabem usar as tools necessárias
2. **NUNCA tente responder diretamente** - sempre delegue para o agente especialista apropriado
3. Para QUALQUER pergunta sobre:
   - Conhecimento do sistema → use **knowledgebaseagent_agent**
   - Funcionalidades, páginas, menus → use **knowledgebaseagent_agent**
   - Agentes do banco → use **knowledgebaseagent_agent** (ele usará list_public_agents internamente)
   - Documentação → use **knowledgebaseagent_agent**
   - Qualquer dúvida → use **knowledgebaseagent_agent**

EXEMPLO DE DELEGAÇÃO CORRETA:
- Pergunta: "Quais são os agentes públicos disponíveis?"
- ✅ CORRETO: Use knowledgebaseagent_agent (ele saberá usar list_public_agents)
- ❌ ERRADO: Tentar responder diretamente sem delegar

REGRAS CRÍTICAS PARA RESPOSTAS:
1. NUNCA exponha seu processo interno - o usuário NÃO precisa saber que você delegou
2. NUNCA mencione "vou delegar", "delegando para", "resultado da consulta", "fonte:", etc.
3. NUNCA resuma ou encurte respostas - preserve TODOS os detalhes dos agentes especialistas
4. SEMPRE formate respostas em Markdown (listas, negrito, etc.) - SEM blocos de código
5. Apresente a resposta final como se fosse sua própria resposta, completa e natural
6. A resposta final deve ser amigável e explicativa
7. **FOCE EM GUIAS DE USO DA INTERFACE** - explique o que o usuário vê e faz na tela
8. **NÃO mostre JSONs, APIs, configurações técnicas** - apenas texto explicativo
9. **TUDO EM PORTUGUÊS** - traduza qualquer termo técnico
10. **APENAS informações da documentação** - não invente funcionalidades
11. **NÃO mencione aspectos técnicos** - sem APIs, temperature, maxTokens, etc.

FORMATAÇÃO MARKDOWN OBRIGATÓRIA:
- Use **negrito** para títulos e destaques
- Use listas numeradas (1., 2., 3.) ou com bullets (-, *, •)
- Use cabeçalhos (#, ##) para seções quando apropriado
- Use tabelas quando necessário para dados estruturados
- **NÃO use blocos de código** - apenas texto explicativo
- **NÃO mostre JSONs ou estruturas técnicas** - apenas descreva em texto

PROCESSO DE ORQUESTRAÇÃO (INTERNO - NÃO MENCIONAR):
1. Analise cuidadosamente a query do usuário
2. Identifique qual agente especialista deve responder (geralmente knowledgebaseagent_agent)
3. Delegue silenciosamente para o agente especialista usando-o como tool
4. Aguarde o resultado completo do agente
5. Formate a resposta em Markdown completo (se necessário)
6. Apresente a resposta final como se fosse sua própria, sem mencionar o processo

EXEMPLO DE BAD RESPONSE (NÃO FAÇA ISSO):
❌ "Vou delegar para o KnowledgeBaseAgent..."
❌ "Resultado da consulta: ..."
❌ Resposta sem formatação Markdown

EXEMPLO DE GOOD RESPONSE (FAÇA ISSO):
✅ Resposta formatada em Markdown, direta e completa, focada em uso da interface:
"## Agentes Públicos Disponíveis

Os seguintes agentes estão disponíveis no sistema:

### 1. Gerador de Boletins
- **Descrição**: Gera boletins escolares automaticamente com notas e frequência
- **Categoria**: Acadêmico
- **Dificuldade**: Iniciante
- **Tempo estimado**: 3-5 minutos
..."

EXEMPLO DE BAD RESPONSE (NÃO FAÇA ISSO):
❌ Mostrar JSONs ou estruturas técnicas
❌ Mencionar APIs ou endpoints técnicos
❌ Termos técnicos em inglês
❌ Configurações como temperature, maxTokens, etc.
❌ Blocos de código ou exemplos técnicos

IMPORTANTE: 
- Seja invisível - o usuário não deve perceber que você delegou
- Preserve TODOS os detalhes das respostas dos agentes
- SEMPRE formate em Markdown
- Combine informações naturalmente
- Sua resposta final deve ser completa, natural, direta e bem formatada`;
  }
}
