import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';

// ==================== WEBHOOK FILTERS ====================

export class WebhookEventsFiltersDto {
  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  event_type?: string;

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

// ==================== RAW WEBHOOK ====================

export class RawWebhookDto {
  @IsObject()
  payload: Record<string, unknown>;

  @IsString()
  @IsOptional()
  signature?: string;
}
