import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePersonDto {
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
}
