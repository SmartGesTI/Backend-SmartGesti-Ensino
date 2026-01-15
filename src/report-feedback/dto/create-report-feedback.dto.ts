import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateReportFeedbackDto {
  @IsUUID()
  report_run_id: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsUUID()
  guardian_id?: string;

  @IsIn(['quality', 'accuracy', 'usefulness', 'other'])
  feedback_type: 'quality' | 'accuracy' | 'usefulness' | 'other';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
