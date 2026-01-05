import { Injectable, Logger } from '@nestjs/common';
import {
  InputGuardrail,
  OutputGuardrail,
} from '@openai/agents';
import {
  InputGuardrailConfig,
  OutputGuardrailConfig,
} from './guardrail.types';

/**
 * Factory para criar guardrails
 */
@Injectable()
export class GuardrailFactory {
  private readonly logger = new Logger(GuardrailFactory.name);

  /**
   * Cria um input guardrail
   */
  createInputGuardrail(
    config: InputGuardrailConfig,
  ): InputGuardrail {
    return {
      name: config.name,
      execute: config.execute,
    };
  }

  /**
   * Cria um output guardrail
   */
  createOutputGuardrail(
    config: OutputGuardrailConfig,
  ): OutputGuardrail<'text'> {
    return {
      name: config.name,
      execute: config.execute,
    };
  }

  /**
   * Cria múltiplos input guardrails
   */
  createInputGuardrails(
    configs: InputGuardrailConfig[],
  ): InputGuardrail[] {
    return configs.map((config) => this.createInputGuardrail(config));
  }

  /**
   * Cria múltiplos output guardrails
   */
  createOutputGuardrails(
    configs: OutputGuardrailConfig[],
  ): OutputGuardrail<'text'>[] {
    return configs.map((config) => this.createOutputGuardrail(config));
  }
}
