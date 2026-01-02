import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * UrlBuilderService
 * 
 * Responsável por construir URLs dinamicamente baseado no contexto da requisição.
 * Suporta ambientes de desenvolvimento e produção, com subdomínios de tenant.
 */
@Injectable()
export class UrlBuilderService {
  private readonly isProduction: boolean;
  private readonly productionDomain: string;
  private readonly devPort: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.productionDomain = this.configService.get<string>('PRODUCTION_DOMAIN') || 'smartgesti.com.br';
    this.devPort = this.configService.get<string>('FRONTEND_PORT') || '5173';

    this.logger.log(
      `UrlBuilderService inicializado - Ambiente: ${this.isProduction ? 'produção' : 'desenvolvimento'}`,
      'UrlBuilderService',
    );
  }

  /**
   * Constrói a URL base (domínio) baseado no contexto
   * 
   * @param tenantSubdomain - Subdomínio do tenant (ex: "magistral")
   * @param requestOrigin - Origin da requisição HTTP (opcional, para inferir automaticamente)
   * @returns URL base como string (ex: "http://magistral.localhost:5173")
   */
  buildBaseUrl(tenantSubdomain?: string, requestOrigin?: string): string {
    // Se temos o origin da requisição, usar como referência
    if (requestOrigin) {
      try {
        const url = new URL(requestOrigin);
        // Se o origin já tem o padrão correto, retornar
        if (url.hostname.includes('.localhost') || url.hostname.endsWith(this.productionDomain)) {
          return requestOrigin.replace(/\/$/, ''); // Remove trailing slash
        }
      } catch {
        // Origin inválido, continuar com construção manual
      }
    }

    // Construir URL baseado no ambiente e subdomínio
    if (this.isProduction) {
      // Produção: https://{subdomain}.smartgesti.com.br
      const subdomain = tenantSubdomain || 'app';
      return `https://${subdomain}.${this.productionDomain}`;
    } else {
      // Desenvolvimento: http://{subdomain}.localhost:5173
      const subdomain = tenantSubdomain || 'app';
      return `http://${subdomain}.localhost:${this.devPort}`;
    }
  }

  /**
   * Constrói uma URL completa para uma rota específica
   * 
   * @param route - Rota relativa (ex: "/escola/unidade-i/ia/assistente")
   * @param options - Opções de construção
   * @returns URL completa
   */
  buildFullUrl(
    route: string,
    options: {
      tenantSubdomain?: string;
      schoolSlug?: string;
      requestOrigin?: string;
    } = {},
  ): string {
    const baseUrl = this.buildBaseUrl(options.tenantSubdomain, options.requestOrigin);
    
    // Substituir :slug na rota se schoolSlug fornecido
    let finalRoute = route;
    if (options.schoolSlug) {
      finalRoute = finalRoute.replace(':slug', options.schoolSlug);
    }

    // Garantir que a rota começa com /
    if (!finalRoute.startsWith('/')) {
      finalRoute = `/${finalRoute}`;
    }

    return `${baseUrl}${finalRoute}`;
  }

  /**
   * Substitui placeholders em uma rota
   * 
   * @param routePattern - Padrão da rota com placeholders (ex: "/escola/:slug/dashboard")
   * @param params - Parâmetros para substituição
   * @returns Rota com placeholders substituídos
   */
  substituteRouteParams(
    routePattern: string,
    params: Record<string, string>,
  ): string {
    let route = routePattern;
    
    for (const [key, value] of Object.entries(params)) {
      route = route.replace(`:${key}`, value);
    }

    return route;
  }

  /**
   * Extrai informações do origin de uma requisição
   */
  parseRequestOrigin(origin: string): {
    protocol: string;
    hostname: string;
    port: string;
    subdomain?: string;
  } | null {
    try {
      const url = new URL(origin);
      const hostParts = url.hostname.split('.');
      
      // Extrair subdomínio se existir
      let subdomain: string | undefined;
      if (hostParts.length > 1) {
        // Para localhost: subdomain.localhost
        if (hostParts[hostParts.length - 1] === 'localhost') {
          subdomain = hostParts.slice(0, -1).join('.');
        }
        // Para domínio de produção: subdomain.smartgesti.com.br
        else if (hostParts.length > 2) {
          subdomain = hostParts[0];
        }
      }

      return {
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname,
        port: url.port,
        subdomain,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verifica se estamos em ambiente de produção
   */
  isProductionEnvironment(): boolean {
    return this.isProduction;
  }

  /**
   * Obtém o domínio de produção configurado
   */
  getProductionDomain(): string {
    return this.productionDomain;
  }
}
