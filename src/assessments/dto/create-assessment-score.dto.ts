import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  IsIn,
  IsDateString,
  IsObject,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssessmentScoreDto {
  @IsUUID()
  enrollment_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsIn(['graded', 'missing', 'exempt', 'pending'])
  status?: 'graded' | 'missing' | 'exempt' | 'pending';

  @IsOptional()
  @IsInt()
  @Min(1)
  attempt_number?: number;

  @IsOptional()
  @IsDateString()
  submitted_at?: string;

  @IsOptional()
  @IsDateString()
  graded_at?: string;

  @IsOptional()
  @IsUUID()
  graded_by_staff_school_profile_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BulkScoreItemDto {
  @IsUUID()
  enrollment_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsIn(['graded', 'missing', 'exempt', 'pending'])
  status?: 'graded' | 'missing' | 'exempt' | 'pending';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkCreateScoresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkScoreItemDto)
  scores: BulkScoreItemDto[];
}
