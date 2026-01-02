import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service';
import { SitemapService } from '../sitemap/sitemap.service';

export interface PageInfo {
  name: string;
  description: string;
  route: string;
  routePattern: string; // Com :slug, :id, etc.
  features: string[];
  relatedPages: string[];
  category?: 'academico' | 'financeiro' | 'rh' | 'administrativo' | 'ia' | 'geral' | 'dashboard' | 'administracao' | 'calendario' | 'sites' | 'documentos' | 'configuracoes';
}

export interface ApiInfo {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  parameters?: Record<string, any>;
  response?: Record<string, any>;
  examples?: string[];
}

export interface SearchResult {
  title: string;
  content: string;
  type: 'page' | 'api' | 'feature' | 'database';
  relevance: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class KnowledgeService {
  private readonly pages: Map<string, PageInfo> = new Map();
  private readonly apis: Map<string, ApiInfo> = new Map();

  constructor(
    private readonly logger: LoggerService,
    private readonly sitemapService: SitemapService,
  ) {
    this.initializeKnowledge();
  }

  private initializeKnowledge() {
    // Páginas do sistema
    this.pages.set('Dashboard Visão Geral', {
      name: 'Dashboard Visão Geral',
      description: 'Painel principal com visão geral da escola, métricas e estatísticas',
      route: '/escola/:slug/painel',
      routePattern: '/escola/:slug/painel',
      features: [
        'Visualização de métricas gerais',
        'Estatísticas de alunos, turmas e matrículas',
        'Gráficos e indicadores',
        'Acesso rápido a funcionalidades principais',
      ],
      relatedPages: ['Dashboard Acadêmico', 'Dashboard Financeiro'],
      category: 'geral',
    });

    this.pages.set('Dashboard Acadêmico', {
      name: 'Dashboard Acadêmico',
      description: 'Painel com métricas e informações acadêmicas da escola',
      route: '/escola/:slug/painel/academico',
      routePattern: '/escola/:slug/painel/academico',
      features: [
        'Métricas acadêmicas',
        'Estatísticas de turmas e alunos',
        'Análise de desempenho',
        'Indicadores educacionais',
      ],
      relatedPages: ['Dashboard Visão Geral', 'Turmas', 'Alunos'],
      category: 'academico',
    });

    this.pages.set('Dashboard Financeiro', {
      name: 'Dashboard Financeiro',
      description: 'Painel com informações financeiras e contábeis',
      route: '/escola/:slug/painel/financeiro',
      routePattern: '/escola/:slug/painel/financeiro',
      features: [
        'Métricas financeiras',
        'Receitas e despesas',
        'Análise de pagamentos',
        'Relatórios financeiros',
      ],
      relatedPages: ['Dashboard Visão Geral'],
      category: 'financeiro',
    });

    this.pages.set('Relatório Inteligente', {
      name: 'Relatório Inteligente',
      description: 'Gera relatórios acadêmicos, financeiros e de matrículas em PDF usando IA',
      route: '/escola/:slug/ia/relatorio',
      routePattern: '/escola/:slug/ia/relatorio',
      features: [
        'Geração de relatórios em PDF',
        'Filtros por período, turma, aluno',
        'Visualização prévia antes de gerar',
        'Múltiplos tipos de relatórios (Acadêmico, Financeiro, Matrículas, Frequência)',
        'Processamento com IA',
      ],
      relatedPages: ['Criar Agente IA', 'Meus Agentes'],
      category: 'ia',
    });

    this.pages.set('Criar Agente IA', {
      name: 'Criar Agente IA',
      description: 'Cria agentes de IA personalizados usando workflow visual drag-and-drop',
      route: '/escola/:slug/ia/criar',
      routePattern: '/escola/:slug/ia/criar',
      features: [
        'Workflow visual drag-and-drop',
        'Templates pré-configurados',
        'Processamento de documentos (PDF, Word, Excel)',
        'Análise com IA',
        'Geração de relatórios',
        'Configuração de nós e conexões',
      ],
      relatedPages: ['Meus Agentes', 'Ver Agentes', 'Assistente IA'],
      category: 'ia',
    });

    this.pages.set('Meus Agentes', {
      name: 'Meus Agentes',
      description: 'Lista de agentes criados pelo usuário, com opções de editar, executar e excluir',
      route: '/escola/:slug/ia/meus-agentes',
      routePattern: '/escola/:slug/ia/meus-agentes',
      features: [
        'Lista de agentes do usuário',
        'Editar agentes',
        'Executar agentes',
        'Excluir agentes',
        'Filtros e busca',
        'Gerenciar visibilidade (público/privado)',
      ],
      relatedPages: ['Criar Agente IA', 'Ver Agentes'],
      category: 'ia',
    });

    this.pages.set('Ver Agentes', {
      name: 'Ver Agentes',
      description: 'Explorar agentes públicos e colaborativos disponíveis na plataforma',
      route: '/escola/:slug/ia/agentes',
      routePattern: '/escola/:slug/ia/agentes',
      features: [
        'Explorar agentes públicos',
        'Usar agentes como templates',
        'Editar agentes colaborativos',
        'Filtros por categoria e dificuldade',
        'Busca de agentes',
      ],
      relatedPages: ['Criar Agente IA', 'Meus Agentes'],
      category: 'ia',
    });

    this.pages.set('Assistente IA', {
      name: 'Assistente IA',
      description: 'Assistente virtual inteligente que conhece todo o sistema e pode ajudar com perguntas, navegação e consultas',
      route: '/escola/:slug/ia/assistente',
      routePattern: '/escola/:slug/ia/assistente',
      features: [
        'Chat interativo com IA',
        'Conhecimento completo do sistema',
        'Geração de links para páginas',
        'Consultas ao banco de dados',
        'Explicação de funcionalidades',
        'Respostas em tempo real com streaming',
      ],
      relatedPages: ['Criar Agente IA', 'Relatório Inteligente'],
      category: 'ia',
    });

    this.pages.set('Turmas', {
      name: 'Turmas',
      description: 'Gerenciamento de turmas da escola',
      route: '/escola/:slug/turmas',
      routePattern: '/escola/:slug/turmas',
      features: [
        'Listar turmas',
        'Criar e editar turmas',
        'Gerenciar alunos por turma',
        'Visualizar detalhes da turma',
      ],
      relatedPages: ['Alunos', 'Matrículas', 'Dashboard Acadêmico'],
      category: 'academico',
    });

    this.pages.set('Alunos', {
      name: 'Alunos',
      description: 'Gerenciamento de alunos da escola',
      route: '/escola/:slug/alunos',
      routePattern: '/escola/:slug/alunos',
      features: [
        'Listar alunos',
        'Criar e editar alunos',
        'Visualizar perfil do aluno',
        'Histórico acadêmico',
      ],
      relatedPages: ['Turmas', 'Matrículas'],
      category: 'academico',
    });

    this.pages.set('Matrículas', {
      name: 'Matrículas',
      description: 'Gerenciamento de matrículas de alunos',
      route: '/escola/:slug/matriculas',
      routePattern: '/escola/:slug/matriculas',
      features: [
        'Listar matrículas',
        'Criar novas matrículas',
        'Gerenciar matrículas existentes',
        'Histórico de matrículas',
      ],
      relatedPages: ['Alunos', 'Turmas'],
      category: 'academico',
    });

    this.pages.set('Calendário', {
      name: 'Calendário',
      description: 'Calendário de eventos e atividades da escola',
      route: '/escola/:slug/calendario',
      routePattern: '/escola/:slug/calendario',
      features: [
        'Visualizar eventos',
        'Criar novos eventos',
        'Editar eventos',
        'Filtros por data e tipo',
      ],
      relatedPages: [],
      category: 'administrativo',
    });

    this.pages.set('Documentos', {
      name: 'Documentos',
      description: 'Gerenciamento de documentos da escola',
      route: '/escola/:slug/documentos',
      routePattern: '/escola/:slug/documentos',
      features: [
        'Listar documentos',
        'Upload de documentos',
        'Organizar por categorias',
        'Compartilhamento',
      ],
      relatedPages: [],
      category: 'administrativo',
    });

    // APIs do sistema
    this.apis.set('/api/agents', {
      endpoint: '/api/agents',
      method: 'GET',
      description: 'Lista todos os agentes disponíveis',
      parameters: {
        category: 'string (opcional)',
        status: 'string (opcional)',
        visibility: 'string (opcional)',
        myAgents: 'boolean (opcional)',
      },
      response: {
        type: 'array',
        items: 'Agent',
      },
    });

    this.apis.set('/api/agents/:id/execute', {
      endpoint: '/api/agents/:id/execute',
      method: 'POST',
      description: 'Executa um agente com parâmetros específicos',
      parameters: {
        id: 'string (path)',
        body: 'Record<string, any>',
      },
      response: {
        type: 'ExecutionResult',
      },
    });

    this.logger.log(`Knowledge base inicializada: ${this.pages.size} páginas, ${this.apis.size} APIs`, 'KnowledgeService');
  }

  /**
   * Obtém informações sobre uma página
   */
  async getPageInfo(pageName: string, schoolSlug?: string): Promise<PageInfo | null> {
    // Primeiro, tentar buscar no Site Map (mais completo)
    const sitemapResults = this.sitemapService.searchPages(pageName);
    
    if (sitemapResults.length > 0) {
      const topResult = sitemapResults[0];
      const pageInfo = this.sitemapService.getPageInfo(topResult.page.id, schoolSlug);
      
      if (pageInfo) {
        return {
          name: pageInfo.page.name,
          description: pageInfo.page.detailedDescription,
          route: pageInfo.route,
          routePattern: pageInfo.page.routePattern,
          features: pageInfo.page.features,
          relatedPages: pageInfo.page.relatedPages.map((id) => {
            const related = this.sitemapService.getPageById(id);
            return related?.name || id;
          }),
          category: pageInfo.section.category as PageInfo['category'],
        };
      }
    }

    // Fallback para dados antigos (compatibilidade)
    let page = this.pages.get(pageName);
    
    if (page) {
      return page;
    }

    // Busca fuzzy (case-insensitive, parcial)
    for (const [key, value] of this.pages.entries()) {
      if (
        key.toLowerCase().includes(pageName.toLowerCase()) ||
        pageName.toLowerCase().includes(key.toLowerCase()) ||
        value.name.toLowerCase().includes(pageName.toLowerCase())
      ) {
        return value;
      }
    }

    return null;
  }

  /**
   * Obtém rota de uma página considerando o slug da escola
   */
  async getRoute(pageName: string, schoolSlug?: string): Promise<string | null> {
    // Primeiro, tentar buscar no Site Map
    const sitemapResults = this.sitemapService.searchPages(pageName);
    
    if (sitemapResults.length > 0) {
      const route = this.sitemapService.getRoute(sitemapResults[0].page.id, schoolSlug);
      if (route) {
        return route;
      }
    }

    // Fallback para dados antigos
    const page = await this.getPageInfo(pageName, schoolSlug);
    
    if (!page) {
      return null;
    }

    if (!schoolSlug) {
      return page.routePattern;
    }

    // Substituir :slug pelo slug real
    return page.routePattern.replace(':slug', schoolSlug);
  }

  /**
   * Busca no conhecimento do sistema
   */
  async searchKnowledge(query: string, category?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Buscar no Site Map primeiro (mais completo)
    const sitemapResults = this.sitemapService.searchPages(query, category);
    
    for (const result of sitemapResults) {
      const pageInfo = this.sitemapService.getPageInfo(result.page.id);
      if (pageInfo) {
        results.push({
          title: result.page.name,
          content: result.page.detailedDescription,
          type: 'page',
          relevance: result.relevance,
          metadata: {
            route: result.page.routePattern,
            category: pageInfo.section.category,
            features: result.page.features,
            menuPath: result.page.menuPath,
            useCases: result.page.useCases,
          },
        });
      }
    }

    // Buscar em páginas antigas (compatibilidade)
    for (const [key, page] of this.pages.entries()) {
      if (category && page.category !== category && category !== 'all') {
        continue;
      }

      // Verificar se já foi adicionado pelo Site Map
      if (results.some((r) => r.title === page.name)) {
        continue;
      }

      let relevance = 0;
      const searchText = `${page.name} ${page.description} ${page.features.join(' ')}`.toLowerCase();

      // Nome exato
      if (page.name.toLowerCase() === lowerQuery) {
        relevance = 1.0;
      }
      // Nome contém query
      else if (page.name.toLowerCase().includes(lowerQuery)) {
        relevance = 0.8;
      }
      // Descrição contém query
      else if (page.description.toLowerCase().includes(lowerQuery)) {
        relevance = 0.6;
      }
      // Features contém query
      else if (searchText.includes(lowerQuery)) {
        relevance = 0.4;
      }

      if (relevance > 0) {
        results.push({
          title: page.name,
          content: page.description,
          type: 'page',
          relevance,
          metadata: {
            route: page.routePattern,
            category: page.category,
            features: page.features,
          },
        });
      }
    }

    // Buscar em APIs
    for (const [key, api] of this.apis.entries()) {
      if (category && category !== 'api' && category !== 'all') {
        continue;
      }

      const searchText = `${api.endpoint} ${api.description}`.toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push({
          title: `${api.method} ${api.endpoint}`,
          content: api.description,
          type: 'api',
          relevance: 0.5,
          metadata: {
            endpoint: api.endpoint,
            method: api.method,
          },
        });
      }
    }

    // Ordenar por relevância
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Obtém informações sobre uma API
   */
  async getApiInfo(endpoint: string): Promise<ApiInfo | null> {
    // Buscar exato
    let api = this.apis.get(endpoint);
    
    if (api) {
      return api;
    }

    // Buscar por padrão (remover parâmetros)
    const baseEndpoint = endpoint.split('?')[0];
    api = this.apis.get(baseEndpoint);
    
    if (api) {
      return api;
    }

    // Busca parcial
    for (const [key, value] of this.apis.entries()) {
      if (key.includes(endpoint) || endpoint.includes(key)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Lista todas as páginas
   */
  listPages(): PageInfo[] {
    // Combinar páginas do Site Map com páginas antigas
    const sitemapPages: PageInfo[] = [];
    const sections = this.sitemapService.getAllSections();
    
    for (const section of sections) {
      for (const page of section.children) {
        sitemapPages.push({
          name: page.name,
          description: page.description,
          route: page.routePattern,
          routePattern: page.routePattern,
          features: page.features,
          relatedPages: page.relatedPages.map((id) => {
            const related = this.sitemapService.getPageById(id);
            return related?.name || id;
          }),
          category: section.category,
        });
      }
    }

    // Adicionar páginas antigas que não estão no Site Map
    const oldPages = Array.from(this.pages.values());
    for (const oldPage of oldPages) {
      if (!sitemapPages.some((p) => p.name === oldPage.name)) {
        sitemapPages.push(oldPage);
      }
    }

    return sitemapPages;
  }

  /**
   * Lista páginas por categoria
   */
  listPagesByCategory(category: string): PageInfo[] {
    const sitemapPages = this.sitemapService.getPagesByCategory(category);
    
    return sitemapPages.map((page) => {
      const section = this.sitemapService.getAllSections().find((s) => s.category === category);
      return {
        name: page.name,
        description: page.description,
        route: page.routePattern,
        routePattern: page.routePattern,
        features: page.features,
        relatedPages: page.relatedPages.map((id) => {
          const related = this.sitemapService.getPageById(id);
          return related?.name || id;
        }),
        category: (section?.category || category) as PageInfo['category'],
      };
    });
  }

  /**
   * Obtém informações do Site Map
   */
  getSitemapInfo(pageId: string, schoolSlug?: string) {
    return this.sitemapService.getPageInfo(pageId, schoolSlug);
  }
}
