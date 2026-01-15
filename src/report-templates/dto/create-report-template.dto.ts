import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateReportTemplateDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['student', 'enrollment', 'class_group', 'grade_level', 'school'])
  target_kind:
    | 'student'
    | 'enrollment'
    | 'class_group'
    | 'grade_level'
    | 'school';

  @IsOptional()
  @IsIn(['markdown', 'pdf', 'html', 'json'])
  output_format?: 'markdown' | 'pdf' | 'html' | 'json';

  @IsOptional()
  @IsString()
  default_language?: string;

  @IsOptional()
  @IsArray()
  sections?: unknown[];

  @IsOptional()
  @IsObject()
  prompt?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  data_requirements?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateReportTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['markdown', 'pdf', 'html', 'json'])
  output_format?: 'markdown' | 'pdf' | 'html' | 'json';

  @IsOptional()
  @IsString()
  default_language?: string;

  @IsOptional()
  @IsArray()
  sections?: unknown[];

  @IsOptional()
  @IsObject()
  prompt?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  data_requirements?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
