export class CreateSchoolDto {
  name: string;
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
}
