import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateGuardianTenantProfileDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'blocked'])
  status?: 'active' | 'inactive' | 'blocked';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}

export class UpdateGuardianTenantProfileDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'blocked'])
  status?: 'active' | 'inactive' | 'blocked';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  ai_context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ai_summary?: string;
}
