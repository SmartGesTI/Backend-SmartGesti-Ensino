import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsInt,
  IsUrl,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import type {
  CalendarStage,
  BlueprintStatus,
} from '../../common/types/calendar.types';

export class CreateCalendarBlueprintDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  reference_year: number;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  jurisdiction_code?: string;

  @IsEnum(['infantil', 'fundamental', 'medio', 'superior', 'outro'])
  @IsOptional()
  stage?: CalendarStage;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(20)
  min_grade_order_index?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(20)
  max_grade_order_index?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  source_title?: string;

  @IsUrl()
  @IsOptional()
  source_url?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  source_notes?: string;

  @IsEnum(['draft', 'published', 'archived'])
  @IsOptional()
  status?: BlueprintStatus;

  @IsBoolean()
  @IsOptional()
  is_system_blueprint?: boolean;

  @IsString()
  @IsOptional()
  ai_summary?: string;

  @IsObject()
  @IsOptional()
  ai_context?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
