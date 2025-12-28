export interface User {
  id: string;
  auth0_id: string; // Armazena UUID do Supabase (mantido para compatibilidade com schema)
  email: string;
  full_name?: string;
  avatar_url?: string;
  email_verified?: boolean;
  role: string;
  tenant_id?: string;
  current_school_id?: string;
  ai_context?: Record<string, unknown>;
  ai_summary?: string;
  created_at: string;
  updated_at: string;
}
