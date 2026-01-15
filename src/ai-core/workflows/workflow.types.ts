export type WorkflowPattern =
  | 'sequential'
  | 'parallel'
  | 'orchestrator'
  | 'evaluator-optimizer';

export interface WorkflowStep {
  id: string;
  name: string;
  agent?: string;
  tool?: string;
  input?: any;
  condition?: (context: WorkflowContext) => boolean;
  onSuccess?: (result: any, context: WorkflowContext) => void;
  onError?: (error: Error, context: WorkflowContext) => void;
}

export interface WorkflowContext {
  tenantId: string;
  userId: string;
  schoolId?: string;
  data: Record<string, any>;
  results: Record<string, any>;
  errors: Record<string, Error>;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  description?: string;
  pattern: WorkflowPattern;
  steps: WorkflowStep[];
  maxRetries?: number;
  timeout?: number;
}

export interface WorkflowResult {
  success: boolean;
  results: Record<string, any>;
  errors: Record<string, Error>;
  executionTime: number;
}
