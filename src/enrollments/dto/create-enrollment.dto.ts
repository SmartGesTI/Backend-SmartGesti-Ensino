import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  MaxLength,
  IsObject,
} from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID('4', { message: 'ID da escola deve ser um UUID válido' })
  school_id: string;

  @IsUUID('4', { message: 'ID do ano letivo deve ser um UUID válido' })
  academic_year_id: string;

  @IsUUID('4', { message: 'ID do aluno deve ser um UUID válido' })
  student_id: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de matrícula deve estar no formato ISO (YYYY-MM-DD)' },
  )
  enrolled_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;

  // Opcional: já associar a uma turma na criação
  @IsOptional()
  @IsUUID('4', { message: 'ID da turma deve ser um UUID válido' })
  class_group_id?: string;
}
