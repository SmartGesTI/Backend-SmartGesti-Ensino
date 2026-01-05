import { Agent, InputGuardrail, OutputGuardrail } from '@openai/agents-core';
import { RunContext } from '@openai/agents-core';
import { CoreTool } from '../tool/tool.types';
import { CoreContext } from '../context/context.types';

/**
 * Estratégia de multi-agente
 */
export type AgentStrategy = 'manager' | 'handoff' | 'orchestrator' | 'simple';

/**
 * Configuração para criar um agente
 */
export interface CoreAgentConfig<TContext extends CoreContext = CoreContext> {
  name: string;
  instructions:
    | string
    | ((context: RunContext<TContext>) => string | Promise<string>);
  model?: string;
  tools?: CoreTool<TContext>[];
  handoffs?: CoreAgent<TContext>[];
  guardrails?: {
    input?: InputGuardrail[];
    output?: OutputGuardrail<'text'>[];
  };
  strategy?: AgentStrategy;
  category?: string;
  tags?: string[];
  modelSettings?: {
    temperature?: number;
    maxTokens?: number;
    parallelToolCalls?: boolean;
    toolChoice?: 'auto' | 'required' | 'none' | string;
  };
}

/**
 * Interface para agente do core
 */
export interface CoreAgent<TContext extends CoreContext = CoreContext>
  extends Agent<TContext> {
  name: string;
  strategy?: AgentStrategy;
  category?: string;
  tags?: string[];
}

/**
 * Metadados de um agente
 */
export interface AgentMetadata {
  name: string;
  strategy?: AgentStrategy;
  category?: string;
  tags?: string[];
  registeredAt: Date;
  toolsCount: number;
  handoffsCount: number;
}

/**
 * Opções para execução de agente
 */
export interface AgentRunOptions<TContext extends CoreContext = CoreContext> {
  context?: TContext;
  session?: any;
  stream?: boolean;
  modelSettings?: {
    temperature?: number;
    maxTokens?: number;
    parallelToolCalls?: boolean;
    toolChoice?: 'auto' | 'required' | 'none' | string;
  };
}
