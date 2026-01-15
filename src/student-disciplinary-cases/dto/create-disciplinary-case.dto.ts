import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreateDisciplinaryCaseDto {
  @IsUUID()
  student_id: string;

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
  class_group_id?: string;

  @IsIn(['incident', 'behavior_note', 'commendation'])
  case_type: 'incident' | 'behavior_note' | 'commendation';

  @IsIn(['low', 'medium', 'high', 'critical'])
  severity: 'low' | 'medium' | 'high' | 'critical';

  @IsDateString()
  occurred_at: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  immediate_actions?: string;

  @IsOptional()
  @IsIn(['internal', 'restricted', 'guardians', 'mixed'])
  confidentiality?: 'internal' | 'restricted' | 'guardians' | 'mixed';

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

export class UpdateDisciplinaryCaseDto {
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  immediate_actions?: string;

  @IsOptional()
  @IsIn(['internal', 'restricted', 'guardians', 'mixed'])
  confidentiality?: 'internal' | 'restricted' | 'guardians' | 'mixed';

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

export class CloseCaseDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VoidCaseDto {
  @IsString()
  reason: string;
}

export class LinkDocumentDto {
  @IsUUID()
  document_id: string;
}
