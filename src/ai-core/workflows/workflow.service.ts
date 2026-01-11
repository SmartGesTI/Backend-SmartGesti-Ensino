import { Injectable, Logger } from '@nestjs/common';
import { WorkflowConfig, WorkflowContext, WorkflowResult } from './workflow.types';
import { WorkflowExecutorService } from './workflow-executor.service';
import { AgentRegistry } from '../agents/agent.registry';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private readonly workflows: Map<string, WorkflowConfig> = new Map();

  constructor(
    private readonly executor: WorkflowExecutorService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  /**
   * Registra um workflow
   */
  register(config: WorkflowConfig): void {
    if (this.workflows.has(config.id)) {
      this.logger.warn(`Workflow ${config.id} already registered, overwriting`);
    }

    this.workflows.set(config.id, config);
    this.logger.debug(`Registered workflow: ${config.name}`);
  }

  /**
   * Executa um workflow
   */
  async execute(
    workflowId: string,
    context: WorkflowContext,
  ): Promise<WorkflowResult> {
    const config = this.workflows.get(workflowId);
    if (!config) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    return this.executor.execute(config, context);
  }

  /**
   * Obtém um workflow
   */
  get(workflowId: string): WorkflowConfig | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Lista todos os workflows
   */
  list(): string[] {
    return Array.from(this.workflows.keys());
  }
}
