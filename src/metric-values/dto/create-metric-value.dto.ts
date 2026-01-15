import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  IsInt,
  IsObject,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateMetricValueDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsUUID()
  metric_definition_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsOptional()
  @IsDateString()
  as_of_date?: string;

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

  @IsOptional()
  @IsUUID()
  subject_id?: string;

  @IsString()
  target_key: string;

  @IsOptional()
  @IsString()
  period_key?: string;

  @IsOptional()
  @IsString()
  dimension_key?: string;

  @IsOptional()
  @IsNumber()
  value_numeric?: number;

  @IsOptional()
  @IsInt()
  value_integer?: number;

  @IsOptional()
  @IsString()
  value_text?: string;

  @IsOptional()
  @IsObject()
  value_json?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  sample_size?: number;

  @IsOptional()
  @IsIn(['ok', 'estimated', 'partial', 'missing', 'invalid'])
  quality_status?: 'ok' | 'estimated' | 'partial' | 'missing' | 'invalid';

  @IsOptional()
  @IsObject()
  computed_from?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class ComputeMetricValuesDto {
  @IsUUID()
  metric_definition_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsIn(['student', 'enrollment', 'class_group', 'grade_level', 'school'])
  target_kind?:
    | 'student'
    | 'enrollment'
    | 'class_group'
    | 'grade_level'
    | 'school';
}
