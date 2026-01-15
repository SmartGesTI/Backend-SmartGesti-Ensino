import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePersonDocumentDto {
  @IsIn(['cpf', 'rg', 'passport', 'other'], {
    message: 'Tipo de documento deve ser cpf, rg, passport ou other',
  })
  doc_type: 'cpf' | 'rg' | 'passport' | 'other';

  @IsString()
  @MinLength(1, { message: 'Valor do documento é obrigatório' })
  @MaxLength(50, {
    message: 'Valor do documento deve ter no máximo 50 caracteres',
  })
  doc_value: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  issuer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country_code?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}
