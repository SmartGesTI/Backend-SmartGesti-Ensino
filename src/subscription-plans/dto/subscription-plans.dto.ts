import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsUUID,
  IsObject,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// ==================== PLANS ====================

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  tier?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @IsInt()
  @IsOptional()
  sort_order?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

// ==================== PRICES ====================

export class CreatePriceDto {
  @IsUUID()
  provider_id: string;

  @IsString()
  currency: string;

  @IsString()
  interval: string;

  @IsInt()
  amount_cents: number;

  @IsInt()
  @IsOptional()
  trial_days?: number;

  @IsString()
  @IsOptional()
  provider_price_id?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdatePriceDto extends PartialType(CreatePriceDto) {}

// ==================== ENTITLEMENTS ====================

export class CreateEntitlementDto {
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

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateEntitlementDto extends PartialType(CreateEntitlementDto) {}
