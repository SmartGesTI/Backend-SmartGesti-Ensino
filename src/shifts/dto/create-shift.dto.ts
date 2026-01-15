import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(50)
  slug: string;

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Horário de início deve estar no formato HH:MM ou HH:MM:SS',
  })
  start_time?: string;

  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'Horário de término deve estar no formato HH:MM ou HH:MM:SS',
  })
  end_time?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
