import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../shared/tools/tool.interface';
import { SitemapService, UrlContext } from '../sitemap/sitemap.service';

@Injectable()
export class SitemapTool implements Tool {
  name = 'get_sitemap_info';
  description = 'Busca informações detalhadas sobre páginas do sistema, incluindo localização no menu, rota, funcionalidades e como acessar. Use quando o usuário perguntar "onde encontrar", "como acessar" ou "o que tem na página X".';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Nome da página, funcionalidade ou termo de busca (ex: "criar agente", "relatório", "turmas")',
      },
      pageId: {
        type: 'string',
        description: 'ID específico da página (opcional, use se souber o ID exato)',
      },
      category: {
        type: 'string',
        enum: ['ia', 'dashboard', 'academico', 'administracao', 'calendario', 'sites', 'documentos', 'configuracoes', 'all'],
        description: 'Categoria para filtrar a busca (opcional)',
      },
    },
    required: ['query'],
  };

  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * Extrai o contexto de URL do ToolContext
   */
  private getUrlContext(context: ToolContext): UrlContext {
    return {
      schoolSlug: context.schoolSlug,
      tenantSubdomain: context.tenantSubdomain,
      requestOrigin: context.requestOrigin,
    };
  }

  async execute(params: any, context: ToolContext): Promise<any> {
    const { query, pageId, category } = params;
    const urlContext = this.getUrlContext(context);

    if (!query && !pageId) {
      throw new Error('query ou pageId é obrigatório');
    }

    // Se forneceu pageId, buscar diretamente
    if (pageId) {
      const pageInfo = this.sitemapService.getPageInfo(pageId, urlContext.schoolSlug, urlContext);
      
      if (!pageInfo) {
        return {
          found: false,
          message: `Página com ID "${pageId}" não encontrada`,
        };
      }

      const relatedPages = this.sitemapService.getRelatedPages(pageId);

      return {
        found: true,
        page: {
          id: pageInfo.page.id,
          name: pageInfo.page.name,
          description: pageInfo.page.description,
          detailedDescription: pageInfo.page.detailedDescription,
          menuPath: pageInfo.menuPath,
          route: pageInfo.route,
          features: pageInfo.page.features,
          useCases: pageInfo.page.useCases,
          breadcrumb: pageInfo.page.breadcrumb,
          parentMenu: pageInfo.page.parentMenu,
        },
        section: {
          name: pageInfo.section.name,
          description: pageInfo.section.description,
          category: pageInfo.section.category,
        },
        relatedPages: relatedPages.map((p) => ({
          id: p.id,
          name: p.name,
          menuPath: p.menuPath,
          route: this.sitemapService.getRoute(p.id, urlContext.schoolSlug, true, urlContext),
        })),
      };
    }

    // Buscar por query
    const searchResults = this.sitemapService.searchPages(query, category || 'all');

    if (searchResults.length === 0) {
      return {
        found: false,
        message: `Nenhuma página encontrada para "${query}"`,
        suggestion: 'Tente buscar por: "agente", "relatório", "dashboard", "turmas", "alunos", "calendário", etc.',
      };
    }

    // Retornar resultado mais relevante e alguns relacionados
    const topResult = searchResults[0];
    const pageInfo = this.sitemapService.getPageInfo(topResult.page.id, urlContext.schoolSlug, urlContext);

    if (!pageInfo) {
      return {
        found: false,
        message: 'Erro ao obter informações da página',
      };
    }

    const relatedPages = this.sitemapService.getRelatedPages(topResult.page.id);
    const otherResults = searchResults.slice(1, 4).map((r) => ({
      id: r.page.id,
      name: r.page.name,
      menuPath: r.page.menuPath,
      route: this.sitemapService.getRoute(r.page.id, urlContext.schoolSlug, true, urlContext),
      relevance: r.relevance,
    }));

    return {
      found: true,
      query,
      bestMatch: {
        page: {
          id: pageInfo.page.id,
          name: pageInfo.page.name,
          description: pageInfo.page.description,
          detailedDescription: pageInfo.page.detailedDescription,
          menuPath: pageInfo.menuPath,
          route: pageInfo.route,
          features: pageInfo.page.features,
          useCases: pageInfo.page.useCases,
          breadcrumb: pageInfo.page.breadcrumb,
          parentMenu: pageInfo.page.parentMenu,
        },
        section: {
          name: pageInfo.section.name,
          description: pageInfo.section.description,
          category: pageInfo.section.category,
        },
        relevance: topResult.relevance,
        matchType: topResult.matchType,
      },
      relatedPages: relatedPages.map((p) => ({
        id: p.id,
        name: p.name,
        menuPath: p.menuPath,
        route: this.sitemapService.getRoute(p.id, urlContext.schoolSlug, true, urlContext),
      })),
      otherMatches: otherResults.length > 0 ? otherResults : undefined,
      totalResults: searchResults.length,
    };
  }
}
