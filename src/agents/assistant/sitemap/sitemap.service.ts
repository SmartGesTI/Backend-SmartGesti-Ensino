import { Injectable } from '@nestjs/common';
import { SITEMAP_DATA, PAGES_BY_ID, PAGES_BY_ROUTE, MenuItem, MenuSection } from './sitemap.data';
import { LoggerService } from '../../../common/logger/logger.service';
import { UrlBuilderService } from '../../shared/url/url-builder.service';

export interface SitemapSearchResult {
  page: MenuItem;
  relevance: number;
  matchType: 'exact' | 'name' | 'description' | 'feature' | 'useCase';
}

/**
 * Contexto de URL para construção dinâmica de links
 */
export interface UrlContext {
  schoolSlug?: string;
  tenantSubdomain?: string;
  requestOrigin?: string;
}

@Injectable()
export class SitemapService {
  constructor(
    private readonly logger: LoggerService,
    private readonly urlBuilder: UrlBuilderService,
  ) {
    this.logger.log(`SitemapService inicializado`, 'SitemapService');
    this.logger.log(`Site Map carregado: ${SITEMAP_DATA.length} seções, ${PAGES_BY_ID.size} páginas`, 'SitemapService');
  }

  /**
   * Obtém uma página por ID
   */
  getPageById(pageId: string): MenuItem | null {
    return PAGES_BY_ID.get(pageId) || null;
  }

  /**
   * Obtém uma página por padrão de rota
   */
  getPageByRoute(routePattern: string): MenuItem | null {
    return PAGES_BY_ROUTE.get(routePattern) || null;
  }

  /**
   * Constrói o domínio base usando o UrlBuilderService
   * @deprecated Use urlBuilder.buildBaseUrl diretamente
   */
  private buildDomain(urlContext?: UrlContext): string {
    return this.urlBuilder.buildBaseUrl(
      urlContext?.tenantSubdomain,
      urlContext?.requestOrigin,
    );
  }

  /**
   * Gera a rota completa substituindo :slug e adicionando domínio base
   * 
   * @param pageId - ID da página
   * @param schoolSlug - Slug da escola (substitui :slug na rota)
   * @param includeDomain - Se deve incluir o domínio completo
   * @param urlContext - Contexto para construção da URL (tenantSubdomain, requestOrigin)
   */
  getRoute(
    pageId: string,
    schoolSlug?: string,
    includeDomain: boolean = true,
    urlContext?: string | UrlContext, // Retrocompatível: aceita string (tenantSubdomain) ou UrlContext
  ): string | null {
    const page = this.getPageById(pageId);
    if (!page) {
      return null;
    }

    let route = page.routePattern;
    
    if (schoolSlug) {
      route = route.replace(':slug', schoolSlug);
    }

    // Se a rota já começa com http, retornar como está
    if (route.startsWith('http://') || route.startsWith('https://')) {
      return route;
    }

    // Adicionar domínio base se solicitado
    if (includeDomain) {
      // Normalizar urlContext para UrlContext
      const ctx: UrlContext = typeof urlContext === 'string' 
        ? { tenantSubdomain: urlContext }
        : urlContext || {};
      
      return this.urlBuilder.buildFullUrl(route, {
        tenantSubdomain: ctx.tenantSubdomain,
        schoolSlug,
        requestOrigin: ctx.requestOrigin,
      });
    }

    return route;
  }

  /**
   * Obtém o caminho completo no menu (ex: "EducaIA > Criar Agente IA")
   */
  getMenuPath(pageId: string): string | null {
    const page = this.getPageById(pageId);
    if (!page) {
      return null;
    }

    return page.menuPath;
  }

  /**
   * Busca páginas por nome, descrição, funcionalidade ou caso de uso
   */
  searchPages(query: string, category?: string): SitemapSearchResult[] {
    const lowerQuery = query.toLowerCase().trim();
    const results: SitemapSearchResult[] = [];

    if (!lowerQuery) {
      return [];
    }

    // Buscar em todas as seções
    for (const section of SITEMAP_DATA) {
      // Filtrar por categoria se especificado
      if (category && section.category !== category && category !== 'all') {
        continue;
      }

      for (const page of section.children) {
        let relevance = 0;
        let matchType: 'exact' | 'name' | 'description' | 'feature' | 'useCase' = 'name';

        // Busca exata no nome
        if (page.name.toLowerCase() === lowerQuery) {
          relevance = 1.0;
          matchType = 'exact';
        }
        // Nome contém query
        else if (page.name.toLowerCase().includes(lowerQuery)) {
          relevance = 0.9;
          matchType = 'name';
        }
        // Descrição contém query
        else if (page.description.toLowerCase().includes(lowerQuery)) {
          relevance = 0.7;
          matchType = 'description';
        }
        // Descrição detalhada contém query
        else if (page.detailedDescription.toLowerCase().includes(lowerQuery)) {
          relevance = 0.6;
          matchType = 'description';
        }
        // Funcionalidades contém query
        else if (page.features.some((f) => f.toLowerCase().includes(lowerQuery))) {
          relevance = 0.5;
          matchType = 'feature';
        }
        // Casos de uso contém query
        else if (page.useCases.some((uc) => uc.toLowerCase().includes(lowerQuery))) {
          relevance = 0.4;
          matchType = 'useCase';
        }
        // Busca parcial em palavras-chave
        else {
          const searchText = `${page.name} ${page.description} ${page.detailedDescription} ${page.features.join(' ')} ${page.useCases.join(' ')}`.toLowerCase();
          const words = lowerQuery.split(/\s+/);
          const matchingWords = words.filter((word) => searchText.includes(word));
          
          if (matchingWords.length > 0) {
            relevance = 0.3 * (matchingWords.length / words.length);
            matchType = 'description';
          }
        }

        if (relevance > 0) {
          results.push({
            page,
            relevance,
            matchType,
          });
        }
      }
    }

    // Ordenar por relevância
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Busca páginas por funcionalidade específica
   */
  searchByFeature(feature: string): MenuItem[] {
    const lowerFeature = feature.toLowerCase();
    const results: MenuItem[] = [];

    for (const section of SITEMAP_DATA) {
      for (const page of section.children) {
        if (page.features.some((f) => f.toLowerCase().includes(lowerFeature))) {
          results.push(page);
        }
      }
    }

    return results;
  }

  /**
   * Busca páginas por caso de uso
   */
  searchByUseCase(useCase: string): MenuItem[] {
    const lowerUseCase = useCase.toLowerCase();
    const results: MenuItem[] = [];

    for (const section of SITEMAP_DATA) {
      for (const page of section.children) {
        if (page.useCases.some((uc) => uc.toLowerCase().includes(lowerUseCase))) {
          results.push(page);
        }
      }
    }

    return results;
  }

  /**
   * Lista todas as páginas de uma categoria
   */
  getPagesByCategory(category: string): MenuItem[] {
    const section = SITEMAP_DATA.find((s) => s.category === category);
    return section ? section.children : [];
  }

  /**
   * Lista todas as seções do menu
   */
  getAllSections(): MenuSection[] {
    return SITEMAP_DATA;
  }

  /**
   * Obtém informações completas de uma página incluindo menu pai
   * 
   * @param pageId - ID da página
   * @param schoolSlug - Slug da escola
   * @param urlContext - Contexto para construção da URL (pode ser string para retrocompat ou UrlContext)
   */
  getPageInfo(
    pageId: string,
    schoolSlug?: string,
    urlContext?: string | UrlContext,
  ): {
    page: MenuItem;
    section: MenuSection;
    route: string;
    menuPath: string;
  } | null {
    const page = this.getPageById(pageId);
    if (!page) {
      return null;
    }

    const section = SITEMAP_DATA.find((s) => s.children.some((p) => p.id === pageId));
    if (!section) {
      return null;
    }

    // Normalizar urlContext
    const ctx: UrlContext = typeof urlContext === 'string'
      ? { tenantSubdomain: urlContext }
      : urlContext || {};

    // Sempre usar getRoute para garantir substituição do :slug e adicionar domínio
    const route = this.getRoute(pageId, schoolSlug, true, ctx) || page.routePattern;
    
    // Log para debug apenas se houver problema
    if (route.includes(':slug') && schoolSlug) {
      this.logger.warn(
        `Route ainda contém :slug após getRoute! pageId: ${pageId}, schoolSlug: ${schoolSlug}`,
        'SitemapService',
      );
    }

    return {
      page,
      section,
      route,
      menuPath: page.menuPath,
    };
  }

  /**
   * Busca páginas relacionadas
   */
  getRelatedPages(pageId: string): MenuItem[] {
    const page = this.getPageById(pageId);
    if (!page) {
      return [];
    }

    const related: MenuItem[] = [];
    for (const relatedId of page.relatedPages) {
      const relatedPage = this.getPageById(relatedId);
      if (relatedPage) {
        related.push(relatedPage);
      }
    }

    return related;
  }
}
