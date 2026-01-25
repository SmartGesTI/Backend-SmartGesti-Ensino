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
  Matches,
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

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'start_time deve estar no formato HH:MM ou HH:MM:SS',
  })
  @IsOptional()
  start_time?: string; // HH:MM ou HH:MM:SS

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'end_time deve estar no formato HH:MM ou HH:MM:SS',
  })
  @IsOptional()
  end_time?: string; // HH:MM ou HH:MM:SS

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
