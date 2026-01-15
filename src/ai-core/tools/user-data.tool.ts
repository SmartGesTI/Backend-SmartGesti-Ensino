import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { SupabaseService } from '../../supabase/supabase.service';
import { Tool } from '@ai-sdk/provider-utils';

export interface UserDataToolContext {
  tenantId?: string;
  userId?: string;
  schoolId?: string;
}

/**
 * User Data Tool for fetching user-specific information
 * Retrieves preferences, school data, and recent activity
 * Does NOT require approval (user's own data)
 */
@Injectable()
export class UserDataTool {
  private readonly logger = new Logger(UserDataTool.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create the user data tool with context injection
   */
  createTool(context: UserDataToolContext): Tool {
    return tool({
      description:
        'Busca dados do próprio usuário logado. Use para obter preferências, informações da escola vinculada, ou dados do perfil. Não requer aprovação pois são dados do próprio usuário.',
      inputSchema: z.object({
        dataType: z
          .enum(['profile', 'school', 'preferences', 'all'])
          .describe(
            'Tipo de dado a buscar: profile (perfil), school (escola), preferences (preferências de IA), all (todos)',
          ),
      }),
      execute: async ({ dataType }) => {
        try {
          if (!context.userId) {
            return {
              success: false,
              message: 'Usuário não identificado.',
              data: null,
            };
          }

          this.logger.debug(
            `UserData fetch: type=${dataType} for user=${context.userId}`,
          );

          const client = this.supabase.getClient();
          const result: Record<string, any> = {};

          // Fetch user profile
          if (dataType === 'profile' || dataType === 'all') {
            const { data: userData, error: userError } = await client
              .from('users')
              .select(
                'id, full_name, email, role, avatar_url, ai_context, ai_summary, created_at',
              )
              .eq('id', context.userId)
              .single();

            if (userError) {
              this.logger.warn(
                `Error fetching user profile: ${userError.message}`,
              );
            } else {
              result.profile = {
                name: userData.full_name,
                email: userData.email,
                role: userData.role,
                avatarUrl: userData.avatar_url,
                memberSince: userData.created_at,
                aiSummary: userData.ai_summary,
              };
            }
          }

          // Fetch school data
          if (dataType === 'school' || dataType === 'all') {
            if (context.schoolId) {
              const { data: schoolData, error: schoolError } = await client
                .from('schools')
                .select('id, name, slug, address, phone, email, logo_url')
                .eq('id', context.schoolId)
                .single();

              if (schoolError) {
                this.logger.warn(
                  `Error fetching school: ${schoolError.message}`,
                );
              } else {
                result.school = {
                  id: schoolData.id,
                  name: schoolData.name,
                  slug: schoolData.slug,
                  address: schoolData.address,
                  phone: schoolData.phone,
                  email: schoolData.email,
                  logoUrl: schoolData.logo_url,
                };
              }
            } else {
              result.school = null;
            }
          }

          // Fetch AI preferences (from user.ai_context)
          if (dataType === 'preferences' || dataType === 'all') {
            const { data: userData, error: prefError } = await client
              .from('users')
              .select('ai_context')
              .eq('id', context.userId)
              .single();

            if (prefError) {
              this.logger.warn(
                `Error fetching preferences: ${prefError.message}`,
              );
              result.preferences = {};
            } else {
              result.preferences = userData.ai_context || {};
            }
          }

          return {
            success: true,
            message: 'Dados do usuário obtidos com sucesso.',
            data: result,
          };
        } catch (error: any) {
          this.logger.error(
            `UserData tool error: ${error.message}`,
            error.stack,
          );
          throw new Error(`Erro ao buscar dados do usuário: ${error.message}`);
        }
      },
      // Format output for model
      toModelOutput: async ({ input, output }) => {
        if (!output.success || !output.data) {
          return {
            type: 'text',
            value:
              output.message || 'Não foi possível obter os dados do usuário.',
          };
        }

        const parts: string[] = [];

        if (output.data.profile) {
          const p = output.data.profile;
          parts.push('**Perfil do Usuário:**');
          if (p.name) parts.push(`- Nome: ${p.name}`);
          if (p.email) parts.push(`- Email: ${p.email}`);
          if (p.role) parts.push(`- Papel: ${p.role}`);
          if (p.memberSince) {
            const date = new Date(p.memberSince).toLocaleDateString('pt-BR');
            parts.push(`- Membro desde: ${date}`);
          }
          if (p.aiSummary) parts.push(`- Resumo IA: ${p.aiSummary}`);
        }

        if (output.data.school) {
          const s = output.data.school;
          parts.push('\n**Escola Vinculada:**');
          if (s.name) parts.push(`- Nome: ${s.name}`);
          if (s.address) parts.push(`- Endereço: ${s.address}`);
          if (s.phone) parts.push(`- Telefone: ${s.phone}`);
          if (s.email) parts.push(`- Email: ${s.email}`);
        } else if (input.dataType === 'school' || input.dataType === 'all') {
          parts.push('\n**Escola:** Nenhuma escola vinculada.');
        }

        if (
          output.data.preferences &&
          Object.keys(output.data.preferences).length > 0
        ) {
          parts.push('\n**Preferências de IA:**');
          for (const [key, value] of Object.entries(output.data.preferences)) {
            parts.push(`- ${key}: ${JSON.stringify(value)}`);
          }
        }

        return {
          type: 'text',
          value: parts.join('\n') || 'Dados obtidos mas estão vazios.',
        };
      },
    });
  }
}
