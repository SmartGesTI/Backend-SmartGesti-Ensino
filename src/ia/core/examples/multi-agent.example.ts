/**
 * Exemplo: Criar e executar um sistema multi-agente (Manager Pattern)
 *
 * Este exemplo demonstra como criar um agente manager que orquestra
 * múltiplos agentes especialistas usando o padrão "agents as tools"
 */

import { AgentFactory } from '../agent/agent.factory';
import { ToolFactory } from '../tool/tool.factory';
import { AgentRunnerService } from '../runner/agent-runner.service';
import { ContextProvider } from '../context/context.provider';
import { z } from 'zod';

export async function multiAgentExample(
  agentFactory: AgentFactory,
  toolFactory: ToolFactory,
  runnerService: AgentRunnerService,
  contextProvider: ContextProvider,
) {
  // 1. Criar contexto
  const context = contextProvider.getContext('tenant-123', 'user-456', {
    schoolId: 'school-789',
  });

  // 2. Criar tool de busca
  const searchTool = toolFactory.create({
    name: 'search_knowledge_base',
    description: 'Search the knowledge base for information',
    parameters: z.object({
      query: z.string().describe('Search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK }, { context }) => {
      // Simulação de busca
      return {
        results: [
          { title: 'Result 1', content: `Content about ${query}` },
          { title: 'Result 2', content: `More content about ${query}` },
        ],
      };
    },
  });

  // 3. Criar agente especialista para Knowledge Base
  const kbAgent = await agentFactory.create({
    name: 'KnowledgeBaseAgent',
    instructions:
      'You are a specialist in searching and retrieving information from the knowledge base.',
    model: 'gpt-4.1-mini',
    tools: [searchTool],
    strategy: 'simple',
    category: 'rag',
  });

  // 4. Criar tool de listagem de agentes
  const listAgentsTool = toolFactory.create({
    name: 'list_agents',
    description: 'List available agents in the system',
    parameters: z.object({
      category: z.string().optional(),
    }),
    execute: async ({ category }, { context }) => {
      return {
        agents: [
          { name: 'Agent 1', category: 'rag' },
          { name: 'Agent 2', category: 'workflow' },
        ],
      };
    },
  });

  // 5. Criar agente especialista para Tools
  const toolAgent = await agentFactory.create({
    name: 'ToolAgent',
    instructions: 'You execute system tools and operations.',
    model: 'gpt-4.1-mini',
    tools: [listAgentsTool],
    strategy: 'simple',
    category: 'tools',
  });

  // 6. Criar agente Manager que orquestra os especialistas
  const managerAgent = await agentFactory.create({
    name: 'ManagerAgent',
    instructions: `You are a manager agent that orchestrates responses.
    
    Use the following agents:
    - KnowledgeBaseAgent: For searching information
    - ToolAgent: For executing system operations
    
    Analyze the user's request and use the appropriate agent(s) to provide a comprehensive answer.`,
    model: 'gpt-4.1-mini',
    strategy: 'manager',
    handoffs: [kbAgent, toolAgent],
    category: 'manager',
  });

  // 7. Executar manager agent
  const result = await runnerService.run(
    managerAgent,
    'Search for information about TypeScript and list available agents',
    {
      context,
    },
  );

  console.log('Resposta do Manager:', result.finalOutput);
  return result;
}
