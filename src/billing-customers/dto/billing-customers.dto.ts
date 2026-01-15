import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsObject,
  IsEmail,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// ==================== CUSTOMER ====================

export class CreateCustomerDto {
  @IsUUID()
  provider_id: string;

  @IsString()
  @IsOptional()
  provider_customer_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

// ==================== BILLING PROFILE ====================

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  legal_name?: string;

  @IsString()
  @IsOptional()
  trade_name?: string;

  @IsString()
  @IsOptional()
  tax_id?: string;

  @IsEmail()
  @IsOptional()
  billing_email?: string;

  @IsString()
  @IsOptional()
  billing_phone?: string;

  @IsObject()
  @IsOptional()
  address_override?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ==================== PAYMENT METHOD ====================

export class CreatePaymentMethodDto {
  @IsUUID()
  provider_id: string;

  @IsString()
  method_type: string;

  @IsString()
  @IsOptional()
  provider_payment_method_id?: string;

  @IsString()
  @IsOptional()
  card_brand?: string;

  @IsString()
  @IsOptional()
  card_last4?: string;

  @IsString()
  @IsOptional()
  card_exp_month?: string;

  @IsString()
  @IsOptional()
  card_exp_year?: string;

  @IsString()
  @IsOptional()
  holder_name?: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdatePaymentMethodDto extends PartialType(
  CreatePaymentMethodDto,
) {}
