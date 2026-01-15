import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsIn,
  IsDateString,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateAssessmentDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsUUID()
  class_group_subject_id: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsIn(['exam', 'assignment', 'project', 'quiz', 'participation', 'other'])
  assessment_type:
    | 'exam'
    | 'assignment'
    | 'project'
    | 'quiz'
    | 'participation'
    | 'other';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_score?: number;

  @IsOptional()
  @IsDateString()
  scheduled_on?: string;

  @IsOptional()
  @IsDateString()
  due_on?: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
