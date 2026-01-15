import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsIn(['infantil', 'fundamental', 'medio', 'superior', 'outro'])
  stage: 'infantil' | 'fundamental' | 'medio' | 'superior' | 'outro';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
