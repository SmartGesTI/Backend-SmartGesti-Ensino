/**
 * Types Base - Interfaces comuns reutilizáveis
 */

// ============================================
// Campos de Auditoria
// ============================================

export interface AuditFields {
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SoftDeleteFields {
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface AIContextFields {
  ai_context: Record<string, unknown>;
  ai_summary: string | null;
}

// ============================================
// Tipos de Ator
// ============================================

export type ActorType = 'user' | 'ai' | 'system';

// ============================================
// Paginação
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
