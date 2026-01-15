import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';

export class CreateCurriculumSubjectDto {
  @IsUUID()
  subject_id: string;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearly_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weekly_classes?: number;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
