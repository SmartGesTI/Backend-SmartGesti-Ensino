/**
 * Core IA - Exportações principais
 * 
 * Este arquivo exporta todos os componentes principais do Core IA
 * para facilitar as importações em outros módulos.
 */

// Config
export * from './config/core-config.service';
export * from './config/model-config.service';
export * from './config/agent-config.service';

// Context
export * from './context/context.builder';
export * from './context/context.provider';
export * from './context/context.types';

// Agent
export * from './agent/agent.factory';
export * from './agent/agent.registry';
export * from './agent/agent.builder';
export * from './agent/agent.types';
export * from './agent/strategies/manager.strategy';
export * from './agent/strategies/handoff.strategy';
export * from './agent/strategies/orchestrator.strategy';
export * from './agent/strategies/simple.strategy';

// Tool
export * from './tool/tool.factory';
export * from './tool/tool.registry';
export * from './tool/tool.builder';
export * from './tool/tool.types';
export * from './tool/adapters/legacy-tool.adapter';
export * from './tool/adapters/rag-tool.adapter';

// Session
export * from './session/session.factory';
export * from './session/session.registry';
export type { CoreSession, SessionConfig, SessionType, SessionMetadata, SessionFactory } from './session/session.types';
export * from './session/implementations/memory.session';
export * from './session/implementations/supabase.session';
export * from './session/implementations/conversations.session';

// Runner
export * from './runner/agent-runner.service';
export * from './runner/stream-runner.service';
export * from './runner/batch-runner.service';

// Guardrails
export * from './guardrails/guardrail.factory';
export * from './guardrails/guardrail.types';

// Module
export * from './core.module';
