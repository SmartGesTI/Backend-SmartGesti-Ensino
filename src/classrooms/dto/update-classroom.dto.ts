import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';

export class UpdateClassroomDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Capacidade não pode ser negativa' })
  capacity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

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
