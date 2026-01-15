import {
  IsString,
  IsInt,
  IsDateString,
  IsIn,
  IsOptional,
  IsObject,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class CreateAcademicYearDto {
  @IsUUID('4', { message: 'ID da escola deve ser um UUID válido' })
  school_id: string;

  @IsInt()
  @Min(1900)
  @Max(2200)
  year: number;

  @IsDateString(
    {},
    { message: 'Data de início deve estar no formato ISO (YYYY-MM-DD)' },
  )
  start_date: string;

  @IsDateString(
    {},
    { message: 'Data de término deve estar no formato ISO (YYYY-MM-DD)' },
  )
  end_date: string;

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
