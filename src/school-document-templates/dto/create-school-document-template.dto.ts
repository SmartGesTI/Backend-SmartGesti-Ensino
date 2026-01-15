import { IsString, IsOptional, IsUUID, IsIn, IsObject } from 'class-validator';

export class CreateSchoolDocumentTemplateDto {
  @IsUUID()
  document_type_id: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  language_code?: string;

  @IsOptional()
  @IsIn(['html', 'markdown', 'docx'])
  template_format?: 'html' | 'markdown' | 'docx';

  @IsOptional()
  @IsString()
  template_content?: string;

  @IsOptional()
  @IsString()
  template_file_path?: string;

  @IsOptional()
  @IsObject()
  variables_schema?: Record<string, unknown>;

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

export class UpdateSchoolDocumentTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  language_code?: string;

  @IsOptional()
  @IsIn(['html', 'markdown', 'docx'])
  template_format?: 'html' | 'markdown' | 'docx';

  @IsOptional()
  @IsString()
  template_content?: string;

  @IsOptional()
  @IsString()
  template_file_path?: string;

  @IsOptional()
  @IsObject()
  variables_schema?: Record<string, unknown>;

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
