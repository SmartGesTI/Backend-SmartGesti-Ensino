import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Serviço reutilizável para operações de soft-delete
 * Implementa o padrão de exclusão lógica com deleted_at e deleted_by
 */
@Injectable()
export class SoftDeleteService {
  /**
   * Realiza soft-delete de um registro
   * @param supabase Cliente Supabase
   * @param table Nome da tabela
   * @param id ID do registro
   * @param userId ID do usuário que está realizando a exclusão
   */
  async softDelete(
    supabase: SupabaseClient,
    table: string,
    id: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Restaura um registro soft-deleted
   * @param supabase Cliente Supabase
   * @param table Nome da tabela
   * @param id ID do registro
   * @param userId ID do usuário que está realizando a restauração
   */
  async restore(
    supabase: SupabaseClient,
    table: string,
    id: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from(table)
      .update({
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id)
      .not('deleted_at', 'is', null);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Verifica se um registro está soft-deleted
   * @param supabase Cliente Supabase
   * @param table Nome da tabela
   * @param id ID do registro
   */
  async isDeleted(
    supabase: SupabaseClient,
    table: string,
    id: string,
  ): Promise<boolean> {
    const { data } = await supabase
      .from(table)
      .select('deleted_at')
      .eq('id', id)
      .single();

    return data?.deleted_at !== null;
  }

  /**
   * Adiciona filtro de soft-delete a uma query base
   * Retorna o builder com o filtro WHERE deleted_at IS NULL
   */
  filterActive<T>(query: T): T {
    // O tipo genérico permite encadear com qualquer query builder do Supabase
    return (query as any).is('deleted_at', null) as T;
  }

  /**
   * Adiciona filtro para mostrar apenas registros deletados
   */
  filterDeleted<T>(query: T): T {
    return (query as any).not('deleted_at', 'is', null) as T;
  }

  /**
   * Prepara dados de auditoria para criação
   */
  getCreateAuditData(userId?: string): Record<string, any> {
    const now = new Date().toISOString();
    return {
      created_at: now,
      updated_at: now,
      created_by: userId || null,
      updated_by: userId || null,
    };
  }

  /**
   * Prepara dados de auditoria para atualização
   */
  getUpdateAuditData(userId?: string): Record<string, any> {
    return {
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };
  }
}
