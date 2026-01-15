import { IsString, IsOptional, IsInt, IsUUID, IsObject } from 'class-validator';

// ==================== PAYMENT ====================

export class PayInvoiceDto {
  @IsUUID()
  @IsOptional()
  payment_method_id?: string;

  @IsString()
  method_type: string;

  @IsInt()
  @IsOptional()
  installments_count?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ==================== REFUND ====================

export class RefundDto {
  @IsInt()
  amount_cents: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ==================== PAYMENT FILTERS ====================

export class PaymentFiltersDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @IsOptional()
  limit?: number;

  @IsInt()
  @IsOptional()
  offset?: number;
}
