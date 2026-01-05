/**
 * Exemplo: Criar uma tool customizada e usar com um agente
 *
 * Este exemplo demonstra como criar uma tool personalizada
 * usando o ToolFactory e integrá-la com um agente
 */

import { AgentFactory } from '../agent/agent.factory';
import { ToolFactory } from '../tool/tool.factory';
import { ToolBuilder } from '../tool/tool.builder';
import { AgentRunnerService } from '../runner/agent-runner.service';
import { ContextProvider } from '../context/context.provider';
import { z } from 'zod';

export async function customToolExample(
  agentFactory: AgentFactory,
  toolFactory: ToolFactory,
  toolBuilder: ToolBuilder,
  runnerService: AgentRunnerService,
  contextProvider: ContextProvider,
) {
  // 1. Criar contexto
  const context = contextProvider.getContext('tenant-123', 'user-456');

  // 2. Criar tool usando Factory (método direto)
  const weatherTool = toolFactory.create({
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: z.object({
      location: z.string().describe('City name'),
      unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    }),
    execute: async ({ location, unit }, { context }) => {
      // Simulação de API de clima
      return {
        location,
        temperature: unit === 'celsius' ? '22°C' : '72°F',
        condition: 'Sunny',
        unit,
      };
    },
    category: 'weather',
    tags: ['api', 'external'],
  });

  // 3. Criar tool usando Builder (método fluente)
  const calculatorTool = toolBuilder
    .withName('calculate')
    .withDescription('Perform mathematical calculations')
    .withParameters(
      z.object({
        expression: z.string().describe('Mathematical expression to evaluate'),
      }),
    )
    .withExecute(async ({ expression }, { context }) => {
      // Simulação de calculadora
      try {
        // AVISO: Em produção, use uma biblioteca segura de avaliação
        const result = eval(expression);
        return { expression, result };
      } catch (error: any) {
        return { expression, error: error.message };
      }
    })
    .withCategory('math')
    .withTags(['calculation', 'utility'])
    .build();

  // 4. Criar agente com as tools customizadas
  const agent = await agentFactory.create({
    name: 'AssistantWithCustomTools',
    instructions: `You are a helpful assistant with access to custom tools.
    
    Available tools:
    - get_weather: Get weather information for any location
    - calculate: Perform mathematical calculations
    
    Use these tools when appropriate to help the user.`,
    model: 'gpt-4.1-mini',
    tools: [weatherTool, calculatorTool],
    strategy: 'simple',
  });

  // 5. Executar agente com diferentes queries
  const weatherResult = await runnerService.run(
    agent,
    'What is the weather in São Paulo?',
    { context },
  );

  console.log('Resposta sobre clima:', weatherResult.finalOutput);

  const calcResult = await runnerService.run(
    agent,
    'Calculate 15 * 23 + 42',
    { context },
  );

  console.log('Resposta sobre cálculo:', calcResult.finalOutput);

  return { weatherResult, calcResult };
}
