import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  IsArray,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class CreatePreEnrollmentReviewDto {
  @IsUUID()
  application_id: string;

  @IsIn(['ai_intake', 'ai_duplicate_check', 'human_review', 'system'])
  review_type: 'ai_intake' | 'ai_duplicate_check' | 'human_review' | 'system';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsArray()
  missing_fields?: unknown[];

  @IsOptional()
  @IsArray()
  flags?: unknown[];

  @IsOptional()
  @IsArray()
  recommendations?: unknown[];

  @IsOptional()
  @IsString()
  summary_markdown?: string;

  @IsOptional()
  @IsObject()
  structured_output?: Record<string, unknown>;

  @IsIn(['ai', 'user', 'system'])
  actor_type: 'ai' | 'user' | 'system';

  @IsOptional()
  @IsUUID()
  actor_id?: string;
}
