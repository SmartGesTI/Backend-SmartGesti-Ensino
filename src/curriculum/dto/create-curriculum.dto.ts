import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsIn,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCurriculumDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsUUID()
  grade_level_id: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsIn(['draft', 'active', 'archived'])
  status?: 'draft' | 'active' | 'archived';

  @IsOptional()
  @IsString()
  description?: string;

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
