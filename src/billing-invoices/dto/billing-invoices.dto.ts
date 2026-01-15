import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  IsObject,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// ==================== INVOICE ====================

export class CreateInvoiceDto {
  @IsUUID()
  @IsOptional()
  tenant_subscription_id?: string;

  @IsString()
  @IsOptional()
  collection_method?: string;

  @IsString()
  currency: string;

  @IsDateString()
  @IsOptional()
  due_at?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

// ==================== INVOICE LINE ====================

export class AddLineDto {
  @IsString()
  line_type: string;

  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsInt()
  unit_amount_cents: number;

  @IsString()
  @IsOptional()
  reference_table?: string;

  @IsUUID()
  @IsOptional()
  reference_id?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ==================== INVOICE FILTERS ====================

export class InvoiceFiltersDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @IsInt()
  @IsOptional()
  limit?: number;

  @IsInt()
  @IsOptional()
  offset?: number;
}
