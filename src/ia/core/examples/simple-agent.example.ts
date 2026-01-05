/**
 * Exemplo: Criar e executar um agente simples
 *
 * Este exemplo demonstra como criar um agente básico usando o Core IA
 */

import { AgentFactory } from '../agent/agent.factory';
import { AgentRunnerService } from '../runner/agent-runner.service';
import { ContextProvider } from '../context/context.provider';

export async function simpleAgentExample(
  agentFactory: AgentFactory,
  runnerService: AgentRunnerService,
  contextProvider: ContextProvider,
) {
  // 1. Criar contexto
  const context = contextProvider.getContext('tenant-123', 'user-456', {
    schoolId: 'school-789',
  });

  // 2. Criar agente simples
  const agent = await agentFactory.create({
    name: 'SimpleAssistant',
    instructions: 'You are a helpful assistant that answers questions concisely.',
    model: 'gpt-4.1-mini',
    strategy: 'simple',
  });

  // 3. Executar agente
  const result = await runnerService.run(agent, 'What is TypeScript?', {
    context,
  });

  console.log('Resposta:', result.finalOutput);
  return result;
}
