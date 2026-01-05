import { IsString, IsOptional } from 'class-validator';

/**
 * DTO para request do demo
 */
export class RunDemoDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

/**
 * Step de reasoning
 */
export interface ReasoningStep {
  step: number;
  agent: string;
  thought: string;
  timestamp: number;
}

/**
 * Detalhes de uma tool call
 */
export interface ToolCallDetail {
  id: string;
  agent: string;
  toolName: string;
  arguments: any;
  result: any;
  timestamp: number;
  success: boolean;
}

/**
 * Detalhes de uma delegação
 */
export interface DelegationDetail {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

/**
 * Item do histórico
 */
export interface MessageItem {
  role: string;
  content: string;
  toolCalls?: any[];
  timestamp?: number;
}

/**
 * Metadados da execução
 */
export interface ExecutionMetadata {
  totalAgents: number;
  totalToolCalls: number;
  totalDelegations: number;
  executionTime: number;
  model: string;
}

/**
 * Resultado completo do demo
 */
export interface MultiAgentDemoResult {
  success: boolean;
  query: string;
  finalAnswer: string;
  execution: {
    reasoning: ReasoningStep[];
    toolCalls: ToolCallDetail[];
    delegations: DelegationDetail[];
    history: MessageItem[];
  };
  metadata: ExecutionMetadata;
}
