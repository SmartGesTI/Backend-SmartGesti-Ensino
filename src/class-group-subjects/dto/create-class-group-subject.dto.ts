import {
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';

export class CreateClassGroupSubjectDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsUUID()
  class_group_id: string;

  @IsUUID()
  subject_id: string;

  @IsOptional()
  @IsUUID()
  primary_staff_school_profile_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  weekly_classes?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  ai_summary?: string;
}
