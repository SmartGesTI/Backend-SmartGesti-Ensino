import { ModelMessage } from '@ai-sdk/provider-utils';
import { Tool } from '@ai-sdk/provider-utils';
import { AgentConfig, AgentContext, AgentResult } from './agent.interface';

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  abstract execute(
    prompt: string | ModelMessage[],
    context?: AgentContext,
  ): Promise<AgentResult>;

  abstract stream(
    prompt: string | ModelMessage[],
    context?: AgentContext,
  ): AsyncIterable<AgentResult>;

  getName(): string {
    return this.config.name;
  }

  getDescription(): string {
    return this.config.description || '';
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  protected validateConfig(): void {
    if (!this.config.name) {
      throw new Error('Agent name is required');
    }
  }
}
