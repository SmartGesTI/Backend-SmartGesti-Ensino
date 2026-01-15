import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProviderDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsObject()
  @IsOptional()
  capabilities?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateProviderDto extends PartialType(CreateProviderDto) {}

export class CreateFeatureDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
