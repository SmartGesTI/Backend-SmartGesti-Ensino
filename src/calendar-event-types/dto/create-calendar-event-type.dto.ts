import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import type {
  CalendarEventCategory,
  CalendarVisibility,
} from '../../common/types/calendar.types';

export class CreateCalendarEventTypeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'slug deve começar com letra minúscula e conter apenas letras, números e underscore',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum([
    'academic',
    'holiday',
    'recess',
    'meeting',
    'event',
    'assessment',
    'other',
  ])
  @IsOptional()
  category?: CalendarEventCategory;

  @IsBoolean()
  @IsOptional()
  default_is_instructional?: boolean;

  @IsEnum(['internal', 'guardian', 'public'])
  @IsOptional()
  default_visibility?: CalendarVisibility;

  @IsBoolean()
  @IsOptional()
  is_system_type?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
