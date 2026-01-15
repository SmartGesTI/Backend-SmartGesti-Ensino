import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsDateString,
  IsObject,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(3)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  complement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreatePersonAddressDto extends CreateAddressDto {
  @IsOptional()
  @IsUUID()
  address_id?: string;

  @IsIn(['residential', 'commercial', 'billing', 'other'])
  address_type: 'residential' | 'commercial' | 'billing' | 'other';

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;
}

export class UpdatePersonAddressDto {
  @IsOptional()
  @IsIn(['residential', 'commercial', 'billing', 'other'])
  address_type?: 'residential' | 'commercial' | 'billing' | 'other';

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  country_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  complement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string;
}
