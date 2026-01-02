import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../shared/tools/tool.interface';
import { SupabaseService } from '../../../supabase/supabase.service';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class DatabaseTool implements Tool {
  name = 'query_database';
  description = 'Executa uma consulta SQL no banco de dados (apenas SELECT, com validação de segurança). Use para responder perguntas sobre dados do sistema.';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Query SQL SELECT a ser executada',
      },
      description: {
        type: 'string',
        description: 'Descrição do que você está tentando descobrir (para validação)',
      },
    },
    required: ['query', 'description'],
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
  ) {}

  async execute(params: any, context: ToolContext): Promise<any> {
    const { query, description } = params;

    if (!query || !description) {
      throw new Error('query e description são obrigatórios');
    }

    // Validar que é uma query SELECT
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
      throw new Error('Por segurança, apenas queries SELECT são permitidas');
    }

    // Validar que não contém comandos perigosos
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      if (trimmedQuery.includes(keyword)) {
        throw new Error(`Query contém comando não permitido: ${keyword}`);
      }
    }

    try {
      this.logger.log(`Executando query do assistente: ${description}`, 'DatabaseTool', {
        userId: context.userId,
        query: query.substring(0, 100), // Log apenas primeiros 100 chars
      });

      // Por enquanto, retornar informação de que a funcionalidade requer implementação adicional
      // Em produção, isso deveria usar uma função RPC segura no Supabase
      // ou um serviço dedicado que valida e executa queries
      return {
        success: false,
        message: 'Funcionalidade de consulta ao banco de dados requer configuração adicional. Por favor, use outras tools disponíveis como search_knowledge para buscar informações sobre o sistema.',
        suggestion: 'Use a tool search_knowledge para buscar informações sobre páginas, APIs e funcionalidades do sistema.',
      };
      
      // TODO: Implementar execução segura de queries via RPC ou serviço dedicado
      // Exemplo de implementação futura:
      // const client = this.supabase.getClient();
      // const { data, error } = await client.rpc('execute_safe_query', {
      //   query_text: query,
      // });
      // if (error) throw error;
      // return { success: true, data: data || [], rowCount: Array.isArray(data) ? data.length : 0 };
    } catch (error: any) {
      this.logger.error(`Erro ao executar query: ${error.message}`, 'DatabaseTool');
      throw error;
    }
  }
}
