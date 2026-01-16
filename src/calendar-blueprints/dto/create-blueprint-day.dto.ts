import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  IsDateString,
  MaxLength,
} from 'class-validator';
import type { CalendarDayKind } from '../../common/types/calendar.types';

export class CreateBlueprintDayDto {
  @IsDateString()
  @IsNotEmpty()
  day_date: string;

  @IsEnum(['instructional', 'non_instructional', 'special'])
  @IsOptional()
  day_kind?: CalendarDayKind;

  @IsBoolean()
  @IsOptional()
  is_instructional?: boolean;

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
