import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import type {
  CalendarStage,
  CalendarScopeType,
  AcademicCalendarStatus,
} from '../../common/types/calendar.types';

export class CreateAcademicCalendarDto {
  @IsUUID()
  @IsNotEmpty()
  school_id: string;

  @IsUUID()
  @IsNotEmpty()
  academic_year_id: string;

  @IsUUID()
  @IsOptional()
  based_on_blueprint_id?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsEnum(['school', 'stage', 'grade_level', 'class_group'])
  @IsOptional()
  scope_type?: CalendarScopeType;

  @IsEnum(['infantil', 'fundamental', 'medio', 'superior', 'outro'])
  @IsOptional()
  stage?: CalendarStage;

  @IsUUID()
  @IsOptional()
  grade_level_id?: string;

  @IsUUID()
  @IsOptional()
  class_group_id?: string;

  @IsEnum(['draft', 'active', 'locked', 'archived'])
  @IsOptional()
  status?: AcademicCalendarStatus;

  @IsString()
  @IsOptional()
  ai_summary?: string;

  @IsObject()
  @IsOptional()
  ai_context?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
