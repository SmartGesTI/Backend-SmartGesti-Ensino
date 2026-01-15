import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsBoolean,
  IsObject,
  IsDateString,
} from 'class-validator';

export class CreateInsightInstanceDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsUUID()
  insight_definition_id: string;

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
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  ai_generated?: boolean;

  @IsOptional()
  @IsString()
  ai_model?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;
}

export class DismissInsightDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
