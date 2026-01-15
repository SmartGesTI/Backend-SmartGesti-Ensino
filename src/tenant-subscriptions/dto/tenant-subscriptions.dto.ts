import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsUUID,
  IsObject,
  IsDateString,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// ==================== SUBSCRIPTION ====================

export class CreateSubscriptionDto {
  @IsUUID()
  plan_id: string;

  @IsUUID()
  plan_price_id: string;

  @IsString()
  @IsOptional()
  collection_method?: string;

  @IsUUID()
  @IsOptional()
  payment_method_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ChangePlanDto {
  @IsUUID()
  new_plan_id: string;

  @IsUUID()
  new_price_id: string;

  @IsBoolean()
  @IsOptional()
  prorate?: boolean;
}

export class CancelSubscriptionDto {
  @IsBoolean()
  @IsOptional()
  immediate?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

// ==================== OVERRIDES ====================

export class CreateOverrideDto {
  @IsString()
  entitlement_key: string;

  @IsString()
  entitlement_type: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsNumber()
  @IsOptional()
  limit_value?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  reset_period?: string;

  @IsString()
  @IsOptional()
  enforcement?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateOverrideDto extends PartialType(CreateOverrideDto) {}
