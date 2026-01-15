import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  IsBoolean,
  IsIn,
  IsObject,
  Min,
} from 'class-validator';

export class CreateStudentSubjectResultDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsUUID()
  enrollment_id: string;

  @IsUUID()
  subject_id: string;

  @IsOptional()
  @IsUUID()
  grading_period_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  final_score?: number;

  @IsOptional()
  @IsString()
  final_concept?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  total_absences?: number;

  @IsOptional()
  @IsIn(['in_progress', 'approved', 'reproved', 'recovery', 'exempt'])
  result_status?:
    | 'in_progress'
    | 'approved'
    | 'reproved'
    | 'recovery'
    | 'exempt';

  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  @IsOptional()
  @IsObject()
  computed_from?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
