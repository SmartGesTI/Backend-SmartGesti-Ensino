import { IsString, IsOptional, IsUUID, IsIn, IsObject } from 'class-validator';

export class GenerateReportDto {
  @IsUUID()
  report_template_version_id: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsIn(['student', 'enrollment', 'class_group', 'grade_level', 'school'])
  target_kind:
    | 'student'
    | 'enrollment'
    | 'class_group'
    | 'grade_level'
    | 'school';

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @IsUUID()
  enrollment_id?: string;

  @IsOptional()
  @IsUUID()
  class_group_id?: string;

  @IsOptional()
  @IsUUID()
  grade_level_id?: string;

  @IsUUID()
  academic_year_id: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsOptional()
  @IsIn(['markdown', 'pdf', 'html', 'json'])
  output_format?: 'markdown' | 'pdf' | 'html' | 'json';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateReportRunStatusDto {
  @IsIn(['queued', 'running', 'success', 'failed', 'cancelled'])
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

  @IsOptional()
  @IsString()
  error_message?: string;

  @IsOptional()
  @IsString()
  report_title?: string;

  @IsOptional()
  @IsString()
  report_summary?: string;

  @IsOptional()
  @IsObject()
  report_data?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  rag_document_id?: string;

  @IsOptional()
  @IsString()
  content_hash?: string;
}
