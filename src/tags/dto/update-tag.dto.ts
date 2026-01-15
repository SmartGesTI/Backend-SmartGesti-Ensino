import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTagDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
