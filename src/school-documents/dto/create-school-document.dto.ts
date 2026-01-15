import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreateSchoolDocumentDto {
  @IsUUID()
  document_type_id: string;

  @IsUUID()
  school_id: string;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;

  @IsOptional()
  @IsUUID()
  enrollment_id?: string;

  @IsOptional()
  @IsUUID()
  student_id?: string;

  @IsOptional()
  @IsUUID()
  class_group_id?: string;

  @IsString()
  title: string;

  @IsDateString()
  document_date: string;

  @IsOptional()
  @IsDateString()
  event_at?: string;

  @IsOptional()
  @IsDateString()
  due_at?: string;

  @IsOptional()
  @IsUUID()
  template_id?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['internal', 'guardian', 'student', 'mixed', 'restricted'])
  visibility?: 'internal' | 'guardian' | 'student' | 'mixed' | 'restricted';

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

export class UpdateSchoolDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  document_date?: string;

  @IsOptional()
  @IsDateString()
  event_at?: string;

  @IsOptional()
  @IsDateString()
  due_at?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['internal', 'guardian', 'student', 'mixed', 'restricted'])
  visibility?: 'internal' | 'guardian' | 'student' | 'mixed' | 'restricted';

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

export class IssueDocumentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelDocumentDto {
  @IsString()
  reason: string;
}
