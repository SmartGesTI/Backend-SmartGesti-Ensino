import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsUUID,
  IsObject,
  IsDateString,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// ==================== METRICS ====================

export class CreateMetricDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  reset_period?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateMetricDto extends PartialType(CreateMetricDto) {}

// ==================== USAGE TRACKING ====================

export class TrackUsageDto {
  @IsString()
  metric_key: string;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  reference_table?: string;

  @IsUUID()
  @IsOptional()
  reference_id?: string;

  @IsUUID()
  @IsOptional()
  school_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ==================== USAGE FILTERS ====================

export class UsageHistoryFiltersDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsString()
  @IsOptional()
  metric_key?: string;

  @IsString()
  @IsOptional()
  period?: string;

  @IsInt()
  @IsOptional()
  limit?: number;
}
