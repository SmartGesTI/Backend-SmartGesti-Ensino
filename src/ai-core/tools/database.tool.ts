import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { SupabaseService } from '../../supabase/supabase.service';
import { Tool } from '@ai-sdk/provider-utils';

export interface DatabaseToolContext {
  tenantId?: string;
  userId?: string;
  schoolId?: string;
}

/**
 * Database Tool for safe SQL queries
 * Requires approval for sensitive operations
 */
@Injectable()
export class DatabaseTool {
  private readonly logger = new Logger(DatabaseTool.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create the database tool with context injection
   */
  createTool(context: DatabaseToolContext): Tool {
    return tool({
      description:
        'Executa consultas SQL SELECT no banco de dados para buscar informações sobre dados do sistema. Use para responder perguntas sobre usuários, escolas, configurações, etc. Apenas queries SELECT são permitidas por segurança.',
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            'Query SQL SELECT a ser executada. Deve começar com SELECT e não pode conter comandos perigosos.',
          ),
        description: z
          .string()
          .describe(
            'Descrição do que você está tentando descobrir com esta query (para validação e logging)',
          ),
      }),
      // Require approval for database queries (sensitive operation)
      needsApproval: async ({ query, description }) => {
        // Always require approval for database queries
        // In production, you might want to check query complexity or data sensitivity
        this.logger.warn(`Database query requires approval: ${description}`);
        return true;
      },
      execute: async ({ query, description }) => {
        try {
          // Validate query
          const trimmedQuery = query.trim().toUpperCase();
          if (!trimmedQuery.startsWith('SELECT')) {
            throw new Error(
              'Por segurança, apenas queries SELECT são permitidas',
            );
          }

          // Validate no dangerous keywords
          const dangerousKeywords = [
            'DROP',
            'DELETE',
            'UPDATE',
            'INSERT',
            'ALTER',
            'CREATE',
            'TRUNCATE',
            'EXEC',
            'EXECUTE',
          ];
          for (const keyword of dangerousKeywords) {
            if (trimmedQuery.includes(keyword)) {
              throw new Error(`Query contém comando não permitido: ${keyword}`);
            }
          }

          this.logger.log(`Executing approved database query: ${description}`, {
            userId: context.userId,
            tenantId: context.tenantId,
            query: query.substring(0, 100),
          });

          // Execute query via Supabase client
          // Note: In production, you should use a safe RPC function or query builder
          const client = this.supabase.getClient();
          const { data, error } = await client.rpc('execute_safe_query', {
            query_text: query,
            tenant_id: context.tenantId || null,
          });

          if (error) {
            // If RPC doesn't exist, return a helpful message
            if (error.code === '42883') {
              // Function does not exist
              return {
                success: false,
                message:
                  'Funcionalidade de consulta ao banco de dados requer configuração adicional no Supabase.',
                suggestion:
                  'Por favor, use a tool retrieveKnowledge para buscar informações sobre o sistema na base de conhecimento.',
                error: 'RPC function execute_safe_query not configured',
              };
            }
            throw error;
          }

          return {
            success: true,
            data: data || [],
            rowCount: Array.isArray(data) ? data.length : 0,
            description,
          };
        } catch (error: any) {
          this.logger.error(
            `Database tool error: ${error.message}`,
            error.stack,
          );
          throw new Error(`Erro ao executar query: ${error.message}`);
        }
      },
      // Use toModelOutput to format results efficiently
      toModelOutput: async ({ input, output }) => {
        if (!output.success) {
          return {
            type: 'text',
            value:
              output.message || 'Erro ao executar query no banco de dados.',
          };
        }

        if (output.rowCount === 0) {
          return {
            type: 'text',
            value: `Query executada com sucesso, mas nenhum resultado encontrado para: "${input.description}"`,
          };
        }

        // Format results concisely
        const dataPreview = Array.isArray(output.data)
          ? output.data
              .slice(0, 5)
              .map((row: any) => JSON.stringify(row))
              .join('\n')
          : JSON.stringify(output.data);

        return {
          type: 'text',
          value: `Query executada com sucesso. Encontrados ${output.rowCount} resultado(s) para "${input.description}":\n\n${dataPreview}${
            output.rowCount > 5
              ? `\n\n(mostrando 5 de ${output.rowCount} resultados)`
              : ''
          }`,
        };
      },
    });
  }
}
