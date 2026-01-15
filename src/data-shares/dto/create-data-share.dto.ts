import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  IsObject,
  Min,
  Max,
} from 'class-validator';

export class CreateDataShareDto {
  @IsUUID()
  snapshot_id: string;

  @IsOptional()
  @IsUUID()
  consent_id?: string;

  @IsOptional()
  @IsUUID()
  target_tenant_id?: string;

  @IsOptional()
  @IsUUID()
  target_school_id?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @IsDateString()
  expires_at: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_accesses?: number;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

export class CreateTokenDto {
  @IsOptional()
  @IsDateString()
  expires_at?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_uses?: number;
}

export class RevokeDataShareDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
