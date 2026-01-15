import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
  IsObject,
  IsUUID,
} from 'class-validator';

export class CreateClassGroupDto {
  @IsUUID('4', { message: 'ID da escola deve ser um UUID válido' })
  school_id: string;

  @IsUUID('4', { message: 'ID do ano letivo deve ser um UUID válido' })
  academic_year_id: string;

  @IsUUID('4', { message: 'ID da série deve ser um UUID válido' })
  grade_level_id: string;

  @IsUUID('4', { message: 'ID do turno deve ser um UUID válido' })
  shift_id: string;

  @IsString()
  @MaxLength(20)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Capacidade não pode ser negativa' })
  capacity?: number;

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
