import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
  IsObject,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreatePreEnrollmentApplicationDto {
  @IsUUID()
  school_id: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsUUID()
  household_id: string;

  @IsOptional()
  @IsUUID()
  form_template_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  form_template_version?: number;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;

  @IsOptional()
  @IsUUID()
  desired_grade_level_id?: string;

  @IsOptional()
  @IsUUID()
  desired_shift_id?: string;

  @IsOptional()
  @IsIn([
    'draft',
    'submitted',
    'in_review',
    'needs_info',
    'approved',
    'rejected',
    'converted',
    'cancelled',
    'archived',
  ])
  status?:
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'needs_info'
    | 'approved'
    | 'rejected'
    | 'converted'
    | 'cancelled'
    | 'archived';

  @IsOptional()
  @IsString()
  applicant_notes?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class UpdatePreEnrollmentApplicationDto {
  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;

  @IsOptional()
  @IsUUID()
  desired_grade_level_id?: string;

  @IsOptional()
  @IsUUID()
  desired_shift_id?: string;

  @IsOptional()
  @IsIn([
    'draft',
    'submitted',
    'in_review',
    'needs_info',
    'approved',
    'rejected',
    'converted',
    'cancelled',
    'archived',
  ])
  status?:
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'needs_info'
    | 'approved'
    | 'rejected'
    | 'converted'
    | 'cancelled'
    | 'archived';

  @IsOptional()
  @IsString()
  applicant_notes?: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class ReviewApplicationDto {
  @IsIn(['approved', 'rejected', 'needs_info'])
  decision: 'approved' | 'rejected' | 'needs_info';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  admin_notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ai_score?: number;

  @IsOptional()
  @IsArray()
  ai_missing_fields?: unknown[];

  @IsOptional()
  @IsArray()
  ai_flags?: unknown[];
}
