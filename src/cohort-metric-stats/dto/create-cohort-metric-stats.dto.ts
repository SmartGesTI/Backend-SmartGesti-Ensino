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

export class CreateCohortMetricStatsDto {
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

  @IsIn(['class_group', 'grade_level', 'school'])
  cohort_kind: 'class_group' | 'grade_level' | 'school';

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
  cohort_key: string;

  @IsOptional()
  @IsString()
  period_key?: string;

  @IsOptional()
  @IsString()
  dimension_key?: string;

  @IsInt()
  @Min(0)
  n: number;

  @IsOptional()
  @IsNumber()
  mean?: number;

  @IsOptional()
  @IsNumber()
  median?: number;

  @IsOptional()
  @IsNumber()
  stddev?: number;

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsNumber()
  p10?: number;

  @IsOptional()
  @IsNumber()
  p25?: number;

  @IsOptional()
  @IsNumber()
  p50?: number;

  @IsOptional()
  @IsNumber()
  p75?: number;

  @IsOptional()
  @IsNumber()
  p90?: number;

  @IsOptional()
  @IsIn(['ok', 'estimated', 'partial', 'missing', 'invalid'])
  quality_status?: 'ok' | 'estimated' | 'partial' | 'missing' | 'invalid';

  @IsOptional()
  @IsObject()
  computed_from?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ComputeCohortStatsDto {
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
  @IsIn(['class_group', 'grade_level', 'school'])
  cohort_kind?: 'class_group' | 'grade_level' | 'school';
}
