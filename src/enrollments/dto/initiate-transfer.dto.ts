import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';

/**
 * DTO para iniciar transferência a partir de uma matrícula
 */
export class InitiateTransferDto {
  @IsUUID('4', { message: 'ID do tenant de destino deve ser um UUID válido' })
  to_tenant_id: string;

  @IsOptional()
  @IsUUID('4', { message: 'ID da escola de destino deve ser um UUID válido' })
  to_school_id?: string;

  @IsOptional()
  @IsUUID('4', {
    message: 'ID do ano letivo de destino deve ser um UUID válido',
  })
  to_academic_year_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
