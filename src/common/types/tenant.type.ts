export interface Tenant {
  id: string;
  subdomain: string;
  name: string;
  domain?: string;
  logo_url?: string;
  settings?: Record<string, unknown>;
  ai_context?: Record<string, unknown>;
  razao_social?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  website?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  created_at: string;
  updated_at: string;
}
