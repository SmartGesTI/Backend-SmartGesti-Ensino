import {
  IsOptional,
  IsDateString,
  IsArray,
  IsString,
  IsInt,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class TimelineFiltersDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data inicial deve estar no formato ISO (YYYY-MM-DD)' },
  )
  from_date?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data final deve estar no formato ISO (YYYY-MM-DD)' },
  )
  to_date?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @IsString({ each: true })
  event_types?: string[];

  @IsOptional()
  @IsUUID('4', { message: 'ID da escola deve ser um UUID válido' })
  school_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
