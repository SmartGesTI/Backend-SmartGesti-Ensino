import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsIn,
  IsDateString,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateGradingPeriodDto {
  @IsUUID()
  school_id: string;

  @IsUUID()
  academic_year_id: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsIn(['bimester', 'trimester', 'semester', 'custom'])
  period_type: 'bimester' | 'trimester' | 'semester' | 'custom';

  @IsInt()
  @Min(1)
  order_index: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

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
