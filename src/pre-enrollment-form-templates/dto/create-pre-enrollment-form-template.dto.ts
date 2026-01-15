import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
  IsObject,
  IsArray,
  Min,
} from 'class-validator';

export class CreatePreEnrollmentFormTemplateDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ui_schema?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  required_documents?: unknown[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class UpdatePreEnrollmentFormTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ui_schema?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  required_documents?: unknown[];

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}
