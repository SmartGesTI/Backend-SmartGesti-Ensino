import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  IsObject,
} from 'class-validator';

/**
 * DTO para atualizar perfil do aluno no tenant
 */
export class UpdateStudentTenantProfileDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'blocked'])
  status?: 'active' | 'inactive' | 'blocked';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenant_registration_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

/**
 * DTO para atualizar perfil do aluno na escola
 */
export class UpdateStudentSchoolProfileDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'blocked'])
  status?: 'active' | 'inactive' | 'blocked';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  school_registration_code?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

/**
 * DTO para associar aluno a uma escola
 */
export class AssociateStudentToSchoolDto {
  @IsString()
  school_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  school_registration_code?: string;
}
