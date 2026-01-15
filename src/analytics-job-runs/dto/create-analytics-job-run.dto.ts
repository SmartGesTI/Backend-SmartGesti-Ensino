import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsDateString,
} from 'class-validator';

export class TriggerAnalyticsJobDto {
  @IsIn([
    'compute_metrics',
    'compute_cohort_stats',
    'generate_insights',
    'generate_reports',
    'compute_leaderboards',
  ])
  job_type:
    | 'compute_metrics'
    | 'compute_cohort_stats'
    | 'generate_insights'
    | 'generate_reports'
    | 'compute_leaderboards';

  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsUUID()
  academic_year_id?: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsOptional()
  @IsDateString()
  scheduled_for?: string;

  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateJobStatusDto {
  @IsIn(['queued', 'running', 'success', 'failed', 'cancelled'])
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

  @IsOptional()
  @IsString()
  error_message?: string;

  @IsOptional()
  @IsObject()
  stats?: Record<string, unknown>;
}
