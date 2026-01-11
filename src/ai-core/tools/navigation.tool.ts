import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { SupabaseService } from '../../supabase/supabase.service';
import { Tool } from '@ai-sdk/provider-utils';

export interface NavigationToolContext {
  tenantId?: string;
  userId?: string;
  schoolId?: string;
  schoolSlug?: string;
}

/**
 * Navigation Tool for suggesting system pages and menus
 * Uses RAG document metadata (routePattern, menuPath) to suggest navigation
 */
@Injectable()
export class NavigationTool {
  private readonly logger = new Logger(NavigationTool.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create the navigation tool with context injection
   */
  createTool(context: NavigationToolContext): Tool {
    return tool({
      description:
        'Sugere páginas e menus do sistema SmartGesTI Ensino. Use quando o usuário perguntar "onde encontro...", "como acessar...", ou quando precisar direcionar para uma funcionalidade específica. Retorna rotas e caminhos de menu.',
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            'O que o usuário está procurando (funcionalidade, página, recurso)',
          ),
        category: z
          .string()
          .optional()
          .describe(
            'Categoria opcional para filtrar (ia, dashboard, academico, administracao)',
          ),
      }),
      execute: async ({ query, category }) => {
        try {
          this.logger.debug(`Navigation search: "${query}" (category: ${category || 'all'})`);

          // Search in RAG documents for pages with routes
          const client = this.supabase.getClient();

          let queryBuilder = client
            .from('rag_documents')
            .select('id, title, route_pattern, menu_path, category, tags')
            .not('route_pattern', 'is', null);

          if (category) {
            queryBuilder = queryBuilder.eq('category', category);
          }

          const { data: documents, error } = await queryBuilder;

          if (error) {
            this.logger.error(`Navigation tool error: ${error.message}`);
            throw error;
          }

          if (!documents || documents.length === 0) {
            return {
              found: false,
              message: 'Nenhuma página encontrada para essa busca.',
              suggestions: [],
            };
          }

          // Simple text matching for relevant pages
          const queryLower = query.toLowerCase();
          const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

          const scoredDocs = documents
            .map((doc) => {
              let score = 0;
              const searchText = `${doc.title} ${doc.menu_path || ''} ${(doc.tags || []).join(' ')}`.toLowerCase();

              // Check each word
              for (const word of queryWords) {
                if (searchText.includes(word)) {
                  score += 2;
                }
              }

              // Exact phrase match bonus
              if (searchText.includes(queryLower)) {
                score += 5;
              }

              return { ...doc, score };
            })
            .filter((doc) => doc.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          if (scoredDocs.length === 0) {
            return {
              found: false,
              message:
                'Não encontrei páginas específicas, mas posso ajudar a navegar no sistema.',
              suggestions: [],
            };
          }

          // Build suggestions with resolved routes
          const suggestions = scoredDocs.map((doc) => {
            // Replace :slug with actual school slug if available
            let resolvedRoute = doc.route_pattern;
            if (context.schoolSlug && resolvedRoute) {
              resolvedRoute = resolvedRoute.replace(':slug', context.schoolSlug);
            }
            
            return {
              title: doc.title,
              route: resolvedRoute,
              routePattern: doc.route_pattern, // Keep original pattern for reference
              menuPath: doc.menu_path,
              category: doc.category,
            };
          });

          return {
            found: true,
            message: `Encontrei ${scoredDocs.length} página(s) relacionada(s).`,
            suggestions,
          };
        } catch (error: any) {
          this.logger.error(`Navigation tool error: ${error.message}`, error.stack);
          throw new Error(`Erro ao buscar páginas: ${error.message}`);
        }
      },
      // Format output for model
      toModelOutput: async ({ input, output }) => {
        if (!output.found || output.suggestions.length === 0) {
          return {
            type: 'text',
            value: output.message,
          };
        }

        const formattedSuggestions = output.suggestions
          .map((s: any, i: number) => {
            const parts = [`${i + 1}. **${s.title}**`];
            if (s.menuPath) {
              parts.push(`   📍 Menu: ${s.menuPath}`);
            }
            // Note: route is not shown to user (technical detail)
            // but is included in output for frontend navigation buttons
            return parts.join('\n');
          })
          .join('\n\n');

        return {
          type: 'text',
          value: `${output.message}\n\n${formattedSuggestions}`,
        };
      },
    });
  }
}
