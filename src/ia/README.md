# OpenAI Agents SDK - Documentação Completa

Este diretório contém implementações usando o **OpenAI Agents SDK** para TypeScript.

## 🏗️ Arquitetura Core IA

O diretório `core/` contém uma arquitetura escalável e reutilizável que serve como backbone para todos os sistemas de IA do projeto (RAG, Assistant, Workflow Executor).

### Estrutura do Core

```
src/ia/core/
├── agent/              # Sistema de agentes
├── tool/               # Sistema de tools
├── session/            # Sistema de sessões
├── context/            # Sistema de contexto
├── config/             # Configuração centralizada
├── runner/             # Sistema de execução
├── guardrails/         # Sistema de guardrails
└── examples/           # Exemplos de uso
```

### Componentes Principais

#### 1. Sistema de Agentes (`core/agent/`)

- **AgentFactory**: Factory para criar agentes padronizados
- **AgentRegistry**: Registro e descoberta de agentes
- **AgentBuilder**: Builder pattern para construção fluente
- **Estratégias**: Manager, Handoff, Orchestrator, Simple

#### 2. Sistema de Tools (`core/tool/`)

- **ToolFactory**: Factory para criar tools padronizadas
- **ToolRegistry**: Registro centralizado de tools
- **ToolBuilder**: Builder para tools complexas
- **Adapters**: LegacyToolAdapter, RagToolAdapter

#### 3. Sistema de Sessões (`core/session/`)

- **SessionFactory**: Factory para criar sessões
- **SessionRegistry**: Registro de tipos de sessão
- **Implementações**: MemorySession, SupabaseSession, ConversationsSession

#### 4. Sistema de Contexto (`core/context/`)

- **ContextBuilder**: Builder para construção de contexto
- **ContextProvider**: Provider centralizado com cache

#### 5. Sistema de Configuração (`core/config/`)

- **CoreConfigService**: Configuração geral (API keys, feature flags)
- **ModelConfigService**: Configuração de modelos
- **AgentConfigService**: Configuração de agentes por tipo

#### 6. Sistema de Execução (`core/runner/`)

- **AgentRunnerService**: Execução síncrona/assíncrona
- **StreamRunnerService**: Execução com streaming
- **BatchRunnerService**: Execução em lote com retry

#### 7. Sistema de Guardrails (`core/guardrails/`)

- **GuardrailFactory**: Factory para criar guardrails
- Suporte a Input e Output guardrails

### Uso Básico

#### Criar um Agente Simples

```typescript
import { AgentFactory } from './core/agent/agent.factory';
import { AgentRunnerService } from './core/runner/agent-runner.service';

// Injetar serviços
constructor(
  private agentFactory: AgentFactory,
  private runnerService: AgentRunnerService,
) {}

// Criar agente
const agent = await this.agentFactory.create({
  name: 'MyAgent',
  instructions: 'You are a helpful assistant',
  model: 'gpt-4.1-mini',
});

// Executar
const result = await this.runnerService.run(agent, 'Hello!');
```

#### Criar um Agente com Tools

```typescript
import { ToolFactory } from './core/tool/tool.factory';
import { z } from 'zod';

const tool = this.toolFactory.create({
  name: 'search',
  description: 'Search the knowledge base',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }, { context }) => {
    return await context.searchService.search(query);
  },
});

const agent = await this.agentFactory.create({
  name: 'RAGAgent',
  instructions: 'Answer questions using the knowledge base',
  tools: [tool],
});
```

#### Criar um Multi-Agente (Manager Pattern)

```typescript
// Criar agentes especialistas
const kbAgent = await this.agentFactory.create({
  name: 'KnowledgeBaseAgent',
  instructions: 'Search knowledge base',
  tools: [searchTool],
});

const toolAgent = await this.agentFactory.create({
  name: 'ToolAgent',
  instructions: 'Execute system tools',
  tools: [listAgentsTool],
});

// Criar manager
const manager = await this.agentFactory.create({
  name: 'ManagerAgent',
  instructions: 'Orchestrate responses',
  strategy: 'manager',
  handoffs: [kbAgent, toolAgent],
});
```

#### Usar Builder Pattern

```typescript
const agent = await this.agentBuilder
  .withName('MyAgent')
  .withInstructions('You are helpful')
  .withModel('gpt-4.1-mini')
  .withTool(searchTool)
  .withStrategy('manager')
  .build();
```

#### Criar uma Sessão

```typescript
import { SessionFactory } from './core/session/session.factory';

// Sessão em memória
const memorySession = this.sessionFactory.createMemory();

// Sessão Supabase
const supabaseSession = this.sessionFactory.createSupabase(
  supabaseClient,
  conversationId,
  tenantId,
);

// Executar com sessão
const result = await this.runnerService.run(agent, 'Hello', {
  session: supabaseSession,
  context: { tenantId, userId },
});
```

#### Executar com Streaming

```typescript
import { StreamRunnerService } from './core/runner/stream-runner.service';

for await (const event of this.streamRunner.stream(agent, 'Hello', {
  context,
})) {
  console.log(event);
}
```

### Integração com Sistemas Existentes

#### Adaptar Tools Legadas

```typescript
import { LegacyToolAdapter } from './core/tool/adapters/legacy-tool.adapter';

const legacyTool = this.legacyToolAdapter.adapt(oldTool);
```

#### Adaptar Tools do RAG

```typescript
import { RagToolAdapter } from './core/tool/adapters/rag-tool.adapter';

const ragTool = this.ragToolAdapter.adapt(ragToolDefinition, executeFn);
```

### Módulo NestJS

Importe o `CoreModule` no seu módulo:

```typescript
import { CoreModule } from './ia/core/core.module';

@Module({
  imports: [CoreModule],
  // ...
})
export class YourModule {}
```

Todos os serviços do core estarão disponíveis para injeção.

---

## 📚 Documentação Oficial do SDK

### 🏠 Página Principal
- [OpenAI Agents SDK - Overview](https://openai.github.io/openai-agents-js/)

### 🚀 Guias Principais

#### Fundamentos
- [Quickstart](https://openai.github.io/openai-agents-js/guides/quickstart/)
- [Agents](https://openai.github.io/openai-agents-js/guides/agents/)
- [Running Agents](https://openai.github.io/openai-agents-js/guides/running-agents/)
- [Results](https://openai.github.io/openai-agents-js/guides/results/)

#### Funcionalidades Avançadas
- [Tools](https://openai.github.io/openai-agents-js/guides/tools/)
- [Orchestrating multiple agents](https://openai.github.io/openai-agents-js/guides/multi-agent/)
- [Handoffs](https://openai.github.io/openai-agents-js/guides/handoffs/)
- [Context management](https://openai.github.io/openai-agents-js/guides/context/)
- [Sessions](https://openai.github.io/openai-agents-js/guides/sessions/)
- [Models](https://openai.github.io/openai-agents-js/guides/models/)
- [Guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/)
- [Streaming](https://openai.github.io/openai-agents-js/guides/streaming/)
- [Human-in-the-loop](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/)

#### Integrações
- [Model Context Protocol (MCP)](https://openai.github.io/openai-agents-js/guides/mcp/)
- [Tracing](https://openai.github.io/openai-agents-js/guides/tracing/)
- [Configuring the SDK](https://openai.github.io/openai-agents-js/guides/config/)
- [Troubleshooting](https://openai.github.io/openai-agents-js/guides/troubleshooting/)
- [Release process](https://openai.github.io/openai-agents-js/guides/release/)

#### Extensions
- [Use any model with the AI SDK](https://openai.github.io/openai-agents-js/extensions/ai-sdk/)
- [Connect Realtime Agents to Twilio](https://openai.github.io/openai-agents-js/extensions/twilio/)
- [Cloudflare Workers Transport](https://openai.github.io/openai-agents-js/extensions/cloudflare/)

---

### Principais Classes e Funções

#### Classes Principais
- [Agent](https://openai.github.io/openai-agents-js/openai/agents/classes/agent/)
- [Runner](https://openai.github.io/openai-agents-js/openai/agents-core/classes/runner/)
- [RunResult](https://openai.github.io/openai-agents-js/openai/agents-core/classes/runresult/)
- [RunContext](https://openai.github.io/openai-agents-js/openai/agents-core/classes/runcontext/)
- [MemorySession](https://openai.github.io/openai-agents-js/openai/agents-core/classes/memorysession/)
- [OpenAIConversationsSession](https://openai.github.io/openai-agents-js/openai/agents-openai/classes/openaiconversationssession/)
- [OpenAIResponsesCompactionSession](https://openai.github.io/openai-agents-js/openai/agents-openai/classes/openairesponsescompactionsession/)
- [Handoff](https://openai.github.io/openai-agents-js/openai/agents-core/classes/handoff/)
- [Trace](https://openai.github.io/openai-agents-js/openai/agents-core/classes/trace/)
- [Span](https://openai.github.io/openai-agents-js/openai/agents-core/classes/span/)

#### Interfaces Principais
- [AgentConfiguration](https://openai.github.io/openai-agents-js/openai/agents-core/interfaces/agentconfiguration/)
- [Session](https://openai.github.io/openai-agents-js/openai/agents-core/interfaces/session/)
- [Model](https://openai.github.io/openai-agents-js/openai/agents-core/interfaces/model/)
- [Tool](https://openai.github.io/openai-agents-js/openai/agents-core/type-aliases/tool/)
- [InputGuardrail](https://openai.github.io/openai-agents-js/openai/agents-core/interfaces/inputguardrail/)
- [OutputGuardrail](https://openai.github.io/openai-agents-js/openai/agents-core/interfaces/outputguardrail/)

#### Funções Principais
- [run](https://openai.github.io/openai-agents-js/openai/agents-core/functions/run/)
- [tool](https://openai.github.io/openai-agents-js/openai/agents-core/functions/tool/)
- [setDefaultOpenAIKey](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/setdefaultopenaikey/)
- [setDefaultOpenAIClient](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/setdefaultopenaiclient/)
- [setDefaultModelProvider](https://openai.github.io/openai-agents-js/openai/agents-core/functions/setdefaultmodelprovider/)
- [handoff](https://openai.github.io/openai-agents-js/openai/agents-core/functions/handoff/)
- [getHandoff](https://openai.github.io/openai-agents-js/openai/agents-core/functions/gethandoff/)
- [addTraceProcessor](https://openai.github.io/openai-agents-js/openai/agents-core/functions/addtraceprocessor/)
- [setTraceProcessors](https://openai.github.io/openai-agents-js/openai/agents-core/functions/settraceprocessors/)
- [codeInterpreterTool](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/codeinterpretertool/)
- [webSearchTool](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/websearchtool/)
- [fileSearchTool](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/filesearchtool/)
- [imageGenerationTool](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/imagegenerationtool/)
- [computerTool](https://openai.github.io/openai-agents-js/openai/agents-core/functions/computertool/)
- [shellTool](https://openai.github.io/openai-agents-js/openai/agents-core/functions/shelltool/)
- [startOpenAIConversationsSession](https://openai.github.io/openai-agents-js/openai/agents-openai/functions/startopenaiconversationssession/)

---

## 🎯 Padrões e Exemplos

### Padrões de Multi-Agent
- [Orchestrating multiple agents](https://openai.github.io/openai-agents-js/guides/multi-agent/)
- [Manager (Agents as Tools)](https://openai.github.io/openai-agents-js/guides/agents/#manager-agents-as-tools)
- [Handoffs](https://openai.github.io/openai-agents-js/guides/handoffs/)

### Exemplos de Código
- [GitHub - Agent Patterns Examples](https://github.com/openai/openai-agents-js/tree/main/examples/agent-patterns)
- [OpenAI Cookbook - Multi-Agent Portfolio Collaboration](https://cookbook.openai.com/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration)
- [Github - Customer Service Multiagents Example](https://github.com/openai/openai-agents-js/blob/main/examples/customer-service/index.ts)
- [Github - Assistant](https://github.com/openai/openai-agents-js/tree/main/examples/research-bot)

---

## 🔧 Recursos Principais

### 1. Agents
- **Agent**: LLM com instruções e tools
- **Agent Loop**: Loop automático de chamadas de tools
- **Dynamic Instructions**: Instruções dinâmicas baseadas em contexto
- **Lifecycle Hooks**: Observar ciclo de vida do agente
- **Cloning**: Clonar agentes para variações

### 2. Tools
- **Function Tools**: Converter funções TypeScript em tools
- **Managed Tools**: Code Interpreter, WebSearch, FileSearch
- **MCP Tools**: Model Context Protocol
- **Agents as Tools**: Expor agentes como tools (padrão Manager)

### 3. Sessions
- **MemorySession**: Sessão em memória (desenvolvimento)
- **OpenAIConversationsSession**: Integração com Conversations API
- **OpenAIResponsesCompactionSession**: Compactação automática de histórico
- **Custom Sessions**: Implementar interface Session para qualquer storage

### 4. Context Management
- **Context Injection**: Dependency injection via generics
- **Session Input Callbacks**: Merge customizado de histórico
- **Context Windowing**: Gerenciamento inteligente de contexto

### 5. Guardrails
- **Input Guardrails**: Validação de entrada
- **Output Guardrails**: Validação de saída
- **Tripwires**: Alertas quando guardrails são acionados

### 6. Streaming
- **Text Streaming**: Streaming de texto token por token
- **Event Streaming**: Eventos de tool calls, handoffs, etc.
- **StreamedRunResult**: Resultado de execução com streaming

### 7. Tracing
- **Built-in Tracing**: Rastreamento automático de execuções
- **Trace Export**: Exportar traces para análise
- **Span Management**: Gerenciar spans de execução

### 8. Handoffs
- **Agent Handoffs**: Delegar tarefas para outros agentes
- **Handoff Coordination**: Coordenar múltiplos agentes

---

## 📦 Instalação

```bash
npm install @openai/agents zod@3
```

## 🔑 Configuração

```typescript
import { setDefaultOpenAIKey } from '@openai/agents';

setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
```

## 🚀 Exemplo Básico

```typescript
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
});

const result = await run(agent, 'Write a haiku about recursion.');
console.log(result.finalOutput);
```

---

## 🔗 Links Úteis

- [GitHub Repository](https://github.com/openai/openai-agents-js)
- [Release Notes](https://openai.github.io/openai-agents-js/release-process/)

---

**Última atualização**: 2025-01-XX  
**Versão do SDK**: `@openai/agents@0.3.7`
