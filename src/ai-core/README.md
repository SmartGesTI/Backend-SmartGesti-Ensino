# AI Core Module

Infraestrutura completa e escalável de IA usando Vercel AI SDK como backbone.

## Características

- **Multi-Provider**: Suporte a OpenAI, Anthropic (Claude) e Google (Gemini)
- **Streaming**: Streaming em tempo real por padrão
- **Structured Output**: Output estruturado com Zod
- **Memória Persistente**: Integração com Supabase para histórico de conversas
- **Cache Inteligente**: Cache específico para IA com isolamento multi-tenant
- **Tools Extensíveis**: Sistema fácil de criar e registrar tools
- **Agentes Flexíveis**: Suporte a single e multi-agentes
- **Workflows Completos**: Padrões de workflow prontos para uso

## Estrutura

```
ai-core/
├── config/              # Configurações centralizadas
├── providers/           # Providers de modelos (OpenAI, Anthropic, Google)
├── streaming/           # Sistema de streaming
├── structured/          # Output estruturado
├── memory/              # Sistema de memória (Supabase)
├── cache/               # Sistema de cache
├── tools/               # Sistema de tools
├── agents/              # Sistema de agentes
├── workflows/           # Sistema de workflows
└── dto/                 # DTOs para APIs
```

## Uso Básico

### Configuração

Variáveis de ambiente necessárias:

```env
# OpenAI (padrão)
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o

# Anthropic (opcional)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-3-5-sonnet-20241022

# Google (opcional)
GOOGLE_API_KEY=...
GOOGLE_DEFAULT_MODEL=gemini-1.5-pro

# Configurações gerais
AI_DEFAULT_PROVIDER=openai
AI_ENABLE_STREAMING=true
AI_ENABLE_CACHE=true
AI_CACHE_TTL=3600
```

### Streaming de Texto

```typescript
import { StreamService } from './ai-core';

constructor(private readonly streamService: StreamService) {}

async streamText(prompt: string) {
  const stream$ = await this.streamService.streamText(prompt, {
    provider: 'openai',
    model: 'gpt-4o',
  });

  for await (const event of stream$) {
    if (event.type === 'text') {
      console.log(event.data.text);
    }
  }
}
```

### Output Estruturado

```typescript
import { StructuredOutputService } from './ai-core';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
});

const result = await this.structuredOutput.generateObject(
  'Extract user info: João, 30 years old',
  schema
);

console.log(result.object); // { name: 'João', age: 30 }
```

### Criar um Agente

```typescript
import { AgentFactory } from './ai-core';

const agent = this.agentFactory.createAgent({
  name: 'MyAgent',
  systemPrompt: 'You are a helpful assistant',
  model: 'gpt-4o',
  provider: 'openai',
});

const result = await agent.execute('Hello!', {
  tenantId: '...',
  userId: '...',
});
```

### Criar uma Tool

```typescript
import { ToolRegistry, ToolDefinition } from './ai-core';
import { z } from 'zod';

const tool: ToolDefinition = {
  name: 'search',
  description: 'Search the knowledge base',
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }, context) => {
    // Implementar busca
    return { results: [] };
  },
};

this.toolRegistry.register(tool);
```

### Criar um Workflow

```typescript
import { WorkflowService } from './ai-core';

this.workflowService.register({
  id: 'my-workflow',
  name: 'My Workflow',
  pattern: 'sequential',
  steps: [
    {
      id: 'step1',
      name: 'Step 1',
      agent: 'agent1',
    },
    {
      id: 'step2',
      name: 'Step 2',
      agent: 'agent2',
    },
  ],
});

const result = await this.workflowService.execute('my-workflow', {
  tenantId: '...',
  userId: '...',
  data: {},
  results: {},
  errors: {},
});
```

## Integração com Memória

O módulo usa a tabela `assistant_conversations` do Supabase para armazenar histórico:

- `id`: UUID da conversa
- `user_id`: UUID do usuário
- `tenant_id`: UUID do tenant
- `school_id`: UUID da escola (opcional)
- `messages`: JSONB com array de mensagens

## Padrões de Workflow

1. **Sequential**: Execução sequencial de steps
2. **Parallel**: Execução paralela de steps independentes
3. **Orchestrator**: Padrão orchestrator-worker
4. **Evaluator-Optimizer**: Loop de avaliação e otimização

## Cache

O cache é isolado por tenant e tem TTL configurável. Cacheia:
- Respostas de modelos
- Configurações de modelos
- Resultados de tools (opcional)

## Multi-Tenant

Todas as operações suportam multi-tenant através do `tenantId`:
- Memória isolada por tenant
- Cache isolado por tenant
- Contexto de execução por tenant
