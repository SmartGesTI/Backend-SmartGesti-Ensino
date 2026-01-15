import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  IsBoolean,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';

export class CreateGradeLevelDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(50)
  slug: string;

  @IsIn(['infantil', 'fundamental', 'medio', 'superior', 'outro'], {
    message: 'Etapa deve ser: infantil, fundamental, medio, superior ou outro',
  })
  stage: 'infantil' | 'fundamental' | 'medio' | 'superior' | 'outro';

  @IsInt()
  @Min(1, { message: 'Ordem deve ser maior que 0' })
  order_index: number;

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
