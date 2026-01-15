import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MaxLength,
  MinLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para criar um aluno completo (pessoa + student + perfil tenant)
 */
export class CreateStudentDto {
  // Dados da pessoa
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(255, { message: 'Nome deve ter no máximo 255 caracteres' })
  full_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferred_name?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de nascimento deve estar no formato ISO (YYYY-MM-DD)' },
  )
  birth_date?: string;

  @IsOptional()
  @IsIn(['M', 'F', 'O', 'N'], { message: 'Sexo deve ser M, F, O ou N' })
  sex?: 'M' | 'F' | 'O' | 'N';

  // Dados do perfil tenant
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenant_registration_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // CPF (documento primário)
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;
}

/**
 * DTO para criar aluno a partir de pessoa existente
 */
export class CreateStudentFromPersonDto {
  @IsString()
  person_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tenant_registration_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
