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
import type { CalendarDayKind } from '../../common/types/calendar.types';

export class CreateCalendarDayDto {
  @IsDateString()
  @IsNotEmpty()
  day_date: string;

  @IsEnum(['instructional', 'non_instructional', 'special'])
  @IsOptional()
  day_kind?: CalendarDayKind;

  @IsBoolean()
  @IsOptional()
  is_instructional?: boolean;

  @IsUUID()
  @IsOptional()
  source_blueprint_day_id?: string;

  @IsUUID()
  @IsOptional()
  day_type_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_override?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  override_reason?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
