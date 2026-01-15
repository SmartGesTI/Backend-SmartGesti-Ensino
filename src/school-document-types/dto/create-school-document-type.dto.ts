import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsIn,
  IsInt,
  Min,
  Matches,
  IsObject,
} from 'class-validator';

export class CreateSchoolDocumentTypeDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug deve conter apenas letras minusculas, numeros e hifens',
  })
  slug: string;

  @IsString()
  name: string;

  @IsIn(['secretariat', 'discipline', 'communication', 'administrative'])
  category: 'secretariat' | 'discipline' | 'communication' | 'administrative';

  @IsOptional()
  @IsBoolean()
  is_official_record?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_ack?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_signature?: boolean;

  @IsOptional()
  @IsIn(['none', 'guardian', 'student', 'staff', 'guardian_and_staff'])
  signature_policy?:
    | 'none'
    | 'guardian'
    | 'student'
    | 'staff'
    | 'guardian_and_staff';

  @IsOptional()
  @IsIn(['none', 'per_tenant', 'per_school', 'per_school_year'])
  numbering_mode?: 'none' | 'per_tenant' | 'per_school' | 'per_school_year';

  @IsOptional()
  @IsString()
  default_prefix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retention_years?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

export class UpdateSchoolDocumentTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['secretariat', 'discipline', 'communication', 'administrative'])
  category?: 'secretariat' | 'discipline' | 'communication' | 'administrative';

  @IsOptional()
  @IsBoolean()
  is_official_record?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_ack?: boolean;

  @IsOptional()
  @IsBoolean()
  requires_signature?: boolean;

  @IsOptional()
  @IsIn(['none', 'guardian', 'student', 'staff', 'guardian_and_staff'])
  signature_policy?:
    | 'none'
    | 'guardian'
    | 'student'
    | 'staff'
    | 'guardian_and_staff';

  @IsOptional()
  @IsIn(['none', 'per_tenant', 'per_school', 'per_school_year'])
  numbering_mode?: 'none' | 'per_tenant' | 'per_school' | 'per_school_year';

  @IsOptional()
  @IsString()
  default_prefix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retention_years?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
