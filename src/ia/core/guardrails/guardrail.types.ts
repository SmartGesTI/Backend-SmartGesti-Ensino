import {
  InputGuardrail,
  OutputGuardrail,
  InputGuardrailFunction,
  OutputGuardrailFunction,
} from '@openai/agents-core';

/**
 * Configuração para criar um input guardrail
 */
export interface InputGuardrailConfig {
  name: string;
  description?: string;
  execute: InputGuardrailFunction;
  metadata?: Record<string, any>;
}

/**
 * Configuração para criar um output guardrail
 */
export interface OutputGuardrailConfig {
  name: string;
  description?: string;
  execute: OutputGuardrailFunction<'text'>;
  metadata?: Record<string, any>;
}

/**
 * Resultado de validação de guardrail
 */
export interface GuardrailValidationResult {
  passed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}
