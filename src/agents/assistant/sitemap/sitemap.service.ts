import { Injectable } from '@nestjs/common';
import { SITEMAP_DATA, PAGES_BY_ID, PAGES_BY_ROUTE, MenuItem, MenuSection } from './sitemap.data';
import { LoggerService } from '../../../common/logger/logger.service';

export interface SitemapSearchResult {
  page: MenuItem;
  relevance: number;
  matchType: 'exact' | 'name' | 'description' | 'feature' | 'useCase';
}

@Injectable()
export class SitemapService {
  private readonly baseDomain: string;
  
  constructor(private readonly logger: LoggerService) {
    // Obter domínio base das variáveis de ambiente ou usar padrão
    this.baseDomain = process.env.FRONTEND_URL || 
                     process.env.APP_URL || 
                     process.env.BASE_URL ||
                     'https://sistema.smartgeski.com';
    
    // Remover barra final se houver
    this.baseDomain = this.baseDomain.replace(/\/$/, '');
    
    this.logger.log(`SitemapService inicializado com domínio base: ${this.baseDomain}`, 'SitemapService');
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
   * Constrói o domínio base baseado no tenantSubdomain e ambiente
   */
  private buildDomain(tenantSubdomain?: string): string {
    if (!tenantSubdomain) {
      // Fallback: usar domínio base configurado
      return this.baseDomain;
    }
    
    // Detectar ambiente
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
    
    // Se FRONTEND_URL está configurado e contém o padrão de subdomain, usar
    if (frontendUrl && frontendUrl.includes('*')) {
      // Substituir * pelo subdomain
      return frontendUrl.replace('*', tenantSubdomain);
    }
    
    // Construir domínio baseado no ambiente
    if (isProduction) {
      // Produção: https://{subdomain}.smartgesti.com.br
      return `https://${tenantSubdomain}.smartgesti.com.br`;
    } else {
      // Desenvolvimento: http://{subdomain}.localhost:5173
      return `http://${tenantSubdomain}.localhost:5173`;
    }
  }

  /**
   * Gera a rota completa substituindo :slug e adicionando domínio base
   */
  getRoute(pageId: string, schoolSlug?: string, includeDomain: boolean = true, tenantSubdomain?: string): string | null {
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
      // Remover barra inicial se houver
      const cleanRoute = route.startsWith('/') ? route : `/${route}`;
      const domain = this.buildDomain(tenantSubdomain);
      return `${domain}${cleanRoute}`;
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
   */
  getPageInfo(pageId: string, schoolSlug?: string, tenantSubdomain?: string): {
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

    // Sempre usar getRoute para garantir substituição do :slug e adicionar domínio
    const route = this.getRoute(pageId, schoolSlug, true, tenantSubdomain) || page.routePattern;
    
    // Log para debug
    if (route.includes(':slug') && schoolSlug) {
      console.warn(`[SitemapService] Route ainda contém :slug após getRoute! pageId: ${pageId}, schoolSlug: ${schoolSlug}, route: ${route}`);
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
