import { IsString, MinLength, MaxLength, IsOptional, IsUrl } from 'class-validator';

export class CompleteProfileDto {
  @IsString({ message: 'Nome deve ser um texto' })
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  @MaxLength(50, { message: 'Nome deve ter no máximo 50 caracteres' })
  given_name: string;

  @IsString({ message: 'Sobrenome deve ser um texto' })
  @MinLength(2, { message: 'Sobrenome deve ter pelo menos 2 caracteres' })
  @MaxLength(50, { message: 'Sobrenome deve ter no máximo 50 caracteres' })
  family_name: string;

  @IsOptional()
  @IsUrl({}, { message: 'Avatar deve ser uma URL válida' })
  avatar_url?: string;
}
