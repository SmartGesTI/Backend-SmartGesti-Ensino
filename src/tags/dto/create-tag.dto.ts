import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_system?: boolean;
}
