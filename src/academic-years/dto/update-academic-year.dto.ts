import {
  IsString,
  IsDateString,
  IsIn,
  IsOptional,
  IsObject,
} from 'class-validator';

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de início deve estar no formato ISO (YYYY-MM-DD)' },
  )
  start_date?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de término deve estar no formato ISO (YYYY-MM-DD)' },
  )
  end_date?: string;

  @IsOptional()
  @IsIn(['planning', 'active', 'closed'], {
    message: 'Status deve ser: planning, active ou closed',
  })
  status?: 'planning' | 'active' | 'closed';

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
