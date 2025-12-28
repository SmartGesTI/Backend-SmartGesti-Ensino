export interface School {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  cnpj?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  whatsapp?: string;
  descricao?: string;
  logo_url?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
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
