export interface School {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  settings?: Record<string, unknown>;
  ai_context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchoolMember {
  id: string;
  user_id: string;
  school_id: string;
  role: string;
  permissions?: Record<string, unknown>;
  created_at: string;
}
