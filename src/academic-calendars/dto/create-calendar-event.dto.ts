import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { CalendarVisibility } from '../../common/types/calendar.types';

export class CreateCalendarEventDto {
  @IsUUID()
  @IsOptional()
  event_type_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsBoolean()
  @IsOptional()
  is_all_day?: boolean;

  @IsBoolean()
  @IsOptional()
  affects_instruction?: boolean;

  @IsEnum(['internal', 'guardian', 'public'])
  @IsOptional()
  visibility?: CalendarVisibility;

  @IsUUID()
  @IsOptional()
  grading_period_id?: string;

  @IsUUID()
  @IsOptional()
  source_blueprint_event_id?: string;

  @IsBoolean()
  @IsOptional()
  is_override?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  override_reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
