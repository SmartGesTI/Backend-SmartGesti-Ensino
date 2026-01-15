import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateLeaderboardDefinitionDto {
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

  @IsIn(['school', 'grade_level', 'class_group'])
  scope: 'school' | 'grade_level' | 'class_group';

  @IsOptional()
  @IsUUID()
  grade_level_id?: string;

  @IsOptional()
  @IsUUID()
  class_group_id?: string;

  @IsUUID()
  academic_year_id: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsUUID()
  metric_definition_id: string;

  @IsOptional()
  @IsUUID()
  subject_id?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_direction?: 'asc' | 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  top_n?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_cohort_size?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateLeaderboardDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_direction?: 'asc' | 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  top_n?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_cohort_size?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
